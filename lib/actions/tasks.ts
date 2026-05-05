"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logging/log-error"
import type { TaskStatus } from "@/lib/types/db"

const statusEnum = z.enum(["todo", "doing", "done"])

async function revalidateTaskPaths(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  floorId: string | null
) {
  revalidatePath(`/projects/${projectId}/tasks`)
  revalidatePath(`/projects/${projectId}`)
  if (floorId) {
    const { data: floor } = await supabase
      .from("floors")
      .select("level")
      .eq("id", floorId)
      .single()
    if (floor) {
      revalidatePath(`/projects/${projectId}/floors/${floor.level}`)
    }
  }
}

export async function createTask(input: {
  projectId: string
  floorId?: string | null
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

    const schema = z.object({
      projectId: z.string().uuid(),
      floorId: z.string().uuid().nullable().optional(),
      title: z.string().min(1, "Tytuł jest wymagany").max(200, "Tytuł za długi"),
      description: z.string().max(2000, "Opis za długi").optional(),
      priority: z.number().int().min(1).max(5),
      dueDate: z.string().nullable().optional(),
    })

    const parsed = schema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        project_id: parsed.data.projectId,
        floor_id: parsed.data.floorId ?? null,
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

    await revalidateTaskPaths(supabase, parsed.data.projectId, parsed.data.floorId ?? null)
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
      .select("project_id, floor_id")
      .eq("id", id)
      .single()
    if (!task) return { error: "Zadanie nie istnieje" }

    const { error } = await supabase.from("tasks").update({ status }).eq("id", id)
    if (error) return { error: error.message }

    await revalidateTaskPaths(supabase, task.project_id, task.floor_id)
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
      .select("project_id, floor_id")
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

    await revalidateTaskPaths(supabase, task.project_id, task.floor_id)
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
      .select("project_id, floor_id")
      .eq("id", id)
      .single()
    if (!task) return { error: "Zadanie nie istnieje" }

    const { error } = await supabase.from("tasks").delete().eq("id", id)
    if (error) return { error: error.message }

    await revalidateTaskPaths(supabase, task.project_id, task.floor_id)
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
