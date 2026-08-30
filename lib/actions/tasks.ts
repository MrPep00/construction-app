"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logging/log-error"
import type { TaskStatus } from "@/lib/types/db"

const statusEnum = z.enum(["todo", "doing", "done"])

export type TaskWithScope = {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: number
  due_date: string | null
  created_at: string
  updated_at: string
  floor_id: string | null
  floor_label: string | null
  location_id: string | null
  location_name: string | null
  /** Only populated by getProjectTasks (kanban creator initials) */
  created_by?: string | null
}

export type ProjectTasksResult = {
  tasks: TaskWithScope[]
  /** True when more done tasks exist beyond doneLimit */
  doneHasMore: boolean
}

async function revalidateTaskPaths(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  floorId: string | null,
  locationId?: string | null
) {
  revalidatePath(`/projects/${projectId}/tasks`)
  revalidatePath(`/projects/${projectId}`)

  let resolvedFloorId = floorId

  if (!resolvedFloorId && locationId) {
    const { data: loc } = await supabase
      .from("locations")
      .select("floor_id")
      .eq("id", locationId)
      .single()
    if (loc) resolvedFloorId = loc.floor_id
  }

  if (resolvedFloorId) {
    const { data: floor } = await supabase
      .from("floors")
      .select("level")
      .eq("id", resolvedFloorId)
      .single()
    if (floor) {
      revalidatePath(`/projects/${projectId}/floors/${floor.level}`)
      if (locationId) {
        revalidatePath(`/projects/${projectId}/floors/${floor.level}/${locationId}`)
      }
    }
  }
}

export async function createTask(input: {
  projectId: string
  floorId?: string | null
  locationId?: string | null
  title: string
  description?: string
  priority: number
  dueDate?: string | null
}): Promise<{ data?: { id: string }; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    const schema = z
      .object({
        projectId: z.string().uuid(),
        floorId: z.string().uuid().nullable().optional(),
        locationId: z.string().uuid().nullable().optional(),
        title: z.string().min(1, "Tytuł jest wymagany").max(200, "Tytuł za długi"),
        description: z.string().max(2000, "Opis za długi").optional(),
        priority: z.number().int().min(1).max(5),
        dueDate: z.string().nullable().optional(),
      })
      .refine(
        (d) => !(d.floorId && d.locationId),
        "Zadanie nie może mieć jednocześnie piętra i lokalu"
      )

    const parsed = schema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        project_id: parsed.data.projectId,
        floor_id: parsed.data.floorId ?? null,
        location_id: parsed.data.locationId ?? null,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        priority: parsed.data.priority,
        due_date: parsed.data.dueDate ?? null,
        status: "todo",
        created_by: user.id,
      })
      .select("id")
      .single()

    if (error) return { error: error.message }

    await revalidateTaskPaths(
      supabase,
      parsed.data.projectId,
      parsed.data.floorId ?? null,
      parsed.data.locationId ?? null
    )
    return { data: { id: data.id } }
  } catch (error) {
    await logError({
      error,
      actionName: "createTask",
      context: { projectId: input.projectId },
    })
    return { error: "Nie udało się dodać zadania" }
  }
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus
): Promise<{ data?: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    if (!z.string().uuid().safeParse(id).success) return { error: "Nieprawidłowe ID" }
    if (!statusEnum.safeParse(status).success) return { error: "Nieprawidłowy status" }

    const { data: task } = await supabase
      .from("tasks")
      .select("project_id, floor_id, location_id")
      .eq("id", id)
      .single()
    if (!task) return { error: "Zadanie nie istnieje" }

    const { error } = await supabase.from("tasks").update({ status }).eq("id", id)
    if (error) return { error: error.message }

    await revalidateTaskPaths(supabase, task.project_id, task.floor_id, task.location_id)
    return { data: true }
  } catch (error) {
    await logError({
      error,
      actionName: "updateTaskStatus",
      context: { taskId: id, status },
    })
    return { error: "Nie udało się zaktualizować statusu zadania" }
  }
}

export async function updateTask(
  id: string,
  fields: {
    title?: string
    description?: string | null
    priority?: number
    dueDate?: string | null
  }
): Promise<{ data?: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    if (!z.string().uuid().safeParse(id).success) return { error: "Nieprawidłowe ID" }

    const schema = z.object({
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).nullable().optional(),
      priority: z.number().int().min(1).max(5).optional(),
      dueDate: z.string().nullable().optional(),
    })
    const parsed = schema.safeParse(fields)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }
    }

    const { data: task } = await supabase
      .from("tasks")
      .select("project_id, floor_id, location_id")
      .eq("id", id)
      .single()
    if (!task) return { error: "Zadanie nie istnieje" }

    const updateData: Record<string, unknown> = {}
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title
    if ("description" in parsed.data) updateData.description = parsed.data.description ?? null
    if (parsed.data.priority !== undefined) updateData.priority = parsed.data.priority
    if ("dueDate" in parsed.data) updateData.due_date = parsed.data.dueDate ?? null

    const { error } = await supabase.from("tasks").update(updateData).eq("id", id)
    if (error) return { error: error.message }

    await revalidateTaskPaths(supabase, task.project_id, task.floor_id, task.location_id)
    return { data: true }
  } catch (error) {
    await logError({
      error,
      actionName: "updateTask",
      context: { taskId: id },
    })
    return { error: "Nie udało się zaktualizować zadania" }
  }
}

export async function deleteTask(
  id: string
): Promise<{ data?: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    if (!z.string().uuid().safeParse(id).success) return { error: "Nieprawidłowe ID" }

    const { data: task } = await supabase
      .from("tasks")
      .select("project_id, floor_id, location_id")
      .eq("id", id)
      .single()
    if (!task) return { error: "Zadanie nie istnieje" }

    const { error } = await supabase.from("tasks").delete().eq("id", id)
    if (error) return { error: error.message }

    await revalidateTaskPaths(supabase, task.project_id, task.floor_id, task.location_id)
    return { data: true }
  } catch (error) {
    await logError({
      error,
      actionName: "deleteTask",
      context: { taskId: id },
    })
    return { error: "Nie udało się usunąć zadania" }
  }
}

// Returns project tasks with scope labels (for kanban + project-level panel).
// todo/doing fetched fully; done fetch-capped (most recently updated first).
export async function getProjectTasks(
  projectId: string,
  doneLimit = 100
): Promise<ProjectTasksResult> {
  try {
    const supabase = await createClient()

    const TASK_COLUMNS =
      "id, title, description, status, priority, due_date, created_at, updated_at, floor_id, location_id, created_by"

    const [activeRes, doneRes] = await Promise.all([
      supabase
        .from("tasks")
        .select(TASK_COLUMNS)
        .eq("project_id", projectId)
        .neq("status", "done")
        .order("priority", { ascending: true }),
      supabase
        .from("tasks")
        .select(TASK_COLUMNS)
        .eq("project_id", projectId)
        .eq("status", "done")
        .order("updated_at", { ascending: false })
        .limit(doneLimit + 1),
    ])

    const doneFetched = doneRes.data ?? []
    const doneHasMore = doneFetched.length > doneLimit
    const tasks = [
      ...(activeRes.data ?? []),
      ...(doneHasMore ? doneFetched.slice(0, doneLimit) : doneFetched),
    ]

    if (tasks.length === 0) return { tasks: [], doneHasMore: false }

    // Resolve floor labels
    const floorIds = [...new Set(tasks.filter((t) => t.floor_id).map((t) => t.floor_id as string))]
    const floorLabelMap = new Map<string, string>()
    if (floorIds.length > 0) {
      const { data: floors } = await supabase
        .from("floors")
        .select("id, label")
        .in("id", floorIds)
      ;(floors ?? []).forEach((f) => floorLabelMap.set(f.id, f.label))
    }

    // Resolve location names
    const locationIds = [...new Set(tasks.filter((t) => t.location_id).map((t) => t.location_id as string))]
    const locationNameMap = new Map<string, string>()
    if (locationIds.length > 0) {
      const { data: locs } = await supabase
        .from("locations")
        .select("id, name")
        .in("id", locationIds)
      ;(locs ?? []).forEach((l) => locationNameMap.set(l.id, l.name))
    }

    return {
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status as TaskStatus,
        priority: t.priority,
        due_date: t.due_date,
        created_at: t.created_at,
        updated_at: t.updated_at,
        floor_id: t.floor_id,
        floor_label: t.floor_id ? (floorLabelMap.get(t.floor_id) ?? null) : null,
        location_id: t.location_id,
        location_name: t.location_id ? (locationNameMap.get(t.location_id) ?? null) : null,
        created_by: t.created_by,
      })),
      doneHasMore,
    }
  } catch {
    return { tasks: [], doneHasMore: false }
  }
}

// Returns floor-scoped tasks + location-scoped tasks for all locations on the floor (cascade view)
export async function getFloorTasks(floorId: string): Promise<TaskWithScope[]> {
  try {
    const supabase = await createClient()

    const { data: floor } = await supabase
      .from("floors")
      .select("label")
      .eq("id", floorId)
      .single()
    const floorLabel = floor?.label ?? null

    const { data: floorTasks } = await supabase
      .from("tasks")
      .select("id, title, description, status, priority, due_date, created_at, updated_at")
      .eq("floor_id", floorId)
      .order("priority", { ascending: true })

    const { data: locations } = await supabase
      .from("locations")
      .select("id, name")
      .eq("floor_id", floorId)

    const locationNameMap = new Map<string, string>()
    ;(locations ?? []).forEach((l) => locationNameMap.set(l.id, l.name))

    const locationIds = (locations ?? []).map((l) => l.id as string)
    let locationTasks: Array<{
      id: string
      title: string
      description: string | null
      status: string
      priority: number
      due_date: string | null
      created_at: string
      updated_at: string
      location_id: string | null
    }> = []

    if (locationIds.length > 0) {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, description, status, priority, due_date, created_at, updated_at, location_id")
        .in("location_id", locationIds)
        .order("priority", { ascending: true })
      locationTasks = data ?? []
    }

    return [
      ...(floorTasks ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status as TaskStatus,
        priority: t.priority,
        due_date: t.due_date,
        created_at: t.created_at,
        updated_at: t.updated_at,
        floor_id: floorId,
        floor_label: floorLabel,
        location_id: null,
        location_name: null,
      })),
      ...locationTasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status as TaskStatus,
        priority: t.priority,
        due_date: t.due_date,
        created_at: t.created_at,
        updated_at: t.updated_at,
        floor_id: floorId,
        floor_label: floorLabel,
        location_id: t.location_id,
        location_name: t.location_id ? (locationNameMap.get(t.location_id) ?? null) : null,
      })),
    ]
  } catch {
    return []
  }
}

// Returns only location-scoped tasks (for location detail page)
export async function getLocationTasks(locationId: string): Promise<TaskWithScope[]> {
  try {
    const supabase = await createClient()

    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, description, status, priority, due_date, created_at, updated_at, floor_id, location_id")
      .eq("location_id", locationId)
      .order("priority", { ascending: true })

    return (tasks ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status as TaskStatus,
      priority: t.priority,
      due_date: t.due_date,
      created_at: t.created_at,
      updated_at: t.updated_at,
      floor_id: t.floor_id,
      floor_label: null,
      location_id: t.location_id,
      location_name: null,
    }))
  } catch {
    return []
  }
}
