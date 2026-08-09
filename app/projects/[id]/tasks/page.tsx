import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getProjectTasks } from "@/lib/actions/tasks"
import { type LocationNode } from "@/lib/locations"
import { buildTaskScope, initialsFromEmail } from "@/lib/tasks/scope"
import {
  TasksKanbanClient,
  type KanbanTask,
} from "@/components/tasks/TasksKanbanClient"

const DONE_DEFAULT_LIMIT = 100
const DONE_MAX_LIMIT = 2000

export default async function ProjectTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ done?: string }>
}) {
  const { id } = await params
  const { done: doneParam } = await searchParams
  const doneLimit = Math.min(
    Math.max(Number(doneParam) || DONE_DEFAULT_LIMIT, DONE_DEFAULT_LIMIT),
    DONE_MAX_LIMIT
  )
  const supabase = await createClient()

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, team_id")
    .eq("id", id)
    .single()
  if (!project) return notFound()

  const [{ tasks, doneHasMore }, floorsRes] = await Promise.all([
    getProjectTasks(id, doneLimit),
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
    const scope = buildTaskScope(t, locationById, floorLevelById)
    const creator = t.created_by ? initialsByUserId.get(t.created_by) : undefined

    return {
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
      created_at: t.created_at,
      updated_at: t.updated_at,
      files: [],
      location_name: t.location_name,
      floor_label: t.floor_label,
      ...scope,
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
        doneHasMore={doneHasMore}
        doneLimit={doneLimit}
      />
    </main>
  )
}
