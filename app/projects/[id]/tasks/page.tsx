import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getProjectTasks } from "@/lib/actions/tasks"
import {
  apartmentAncestorId,
  shortFloorLabel,
  type LocationNode,
} from "@/lib/locations"
import {
  TasksKanbanClient,
  type KanbanTask,
} from "@/components/tasks/TasksKanbanClient"

/** "gleb.plotnikov00@example.com" -> "GP" */
function initialsFromEmail(email: string): string {
  const parts = email
    .split("@")[0]
    .split(/[^\p{L}]+/u)
    .filter(Boolean)
  if (parts.length === 0) return email.slice(0, 2).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export default async function ProjectTasksPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, team_id")
    .eq("id", id)
    .single()
  if (!project) return notFound()

  const [tasks, floorsRes] = await Promise.all([
    getProjectTasks(id),
    supabase
      .from("floors")
      .select("id, level, label")
      .eq("project_id", id)
      .order("level", { ascending: false }),
  ])

  const floors = floorsRes.data ?? []
  const floorIds = floors.map((f) => f.id)
  const floorLevelById = new Map(floors.map((f) => [f.id, f.level]))

  const { data: locationsData } =
    floorIds.length > 0
      ? await supabase
          .from("locations")
          .select("id, floor_id, parent_id, name, type")
          .in("floor_id", floorIds)
      : { data: [] }
  const locations = locationsData ?? []
  const locationById = new Map<string, LocationNode & { name: string }>(
    locations.map((l) => [l.id, l])
  )

  // Creator initials via team members RPC (no assignee field in schema)
  const initialsByUserId = new Map<string, { initials: string; email: string }>()
  const { data: members } = await supabase.rpc("get_team_members_with_emails", {
    p_team_id: project.team_id,
  })
  members?.forEach((m: { user_id: string; email: string }) => {
    initialsByUserId.set(m.user_id, {
      initials: initialsFromEmail(m.email),
      email: m.email,
    })
  })

  const kanbanTasks: KanbanTask[] = tasks.map((t) => {
    let scopeType: KanbanTask["scopeType"] = "global"
    let scopeLabel = "Ogólne"
    let effectiveFloorId: string | null = null

    if (t.location_id) {
      scopeType = "location"
      const loc = locationById.get(t.location_id)
      effectiveFloorId = loc?.floor_id ?? null
      const aptId = apartmentAncestorId(t.location_id, locationById)
      const name = aptId
        ? (locationById.get(aptId)?.name ?? loc?.name ?? "?")
        : (loc?.name ?? "?")
      const level = loc ? floorLevelById.get(loc.floor_id) : undefined
      scopeLabel = level !== undefined ? `${name} · ${shortFloorLabel(level)}` : name
    } else if (t.floor_id) {
      scopeType = "floor"
      effectiveFloorId = t.floor_id
      const level = floorLevelById.get(t.floor_id)
      scopeLabel =
        level !== undefined ? shortFloorLabel(level) : (t.floor_label ?? "Piętro")
    }

    const creator = t.created_by ? initialsByUserId.get(t.created_by) : undefined

    return {
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
      created_at: t.created_at,
      files: [],
      location_name: t.location_name,
      floor_label: t.floor_label,
      scopeType,
      scopeLabel,
      effectiveFloorId,
      initials: creator?.initials ?? null,
      creatorEmail: creator?.email ?? null,
    }
  })

  const apartments = locations
    .filter((l) => l.type === "apartment")
    .sort((a, b) => a.name.localeCompare(b.name, "pl", { numeric: true }))
    .map((l) => ({ id: l.id, name: l.name, floor_id: l.floor_id }))

  return (
    <main className="px-4 py-6 md:px-6 lg:px-10">
      <h1 className="mb-6 text-2xl font-bold">Zadania</h1>
      <TasksKanbanClient
        projectId={id}
        tasks={kanbanTasks}
        floors={floors}
        apartments={apartments}
      />
    </main>
  )
}
