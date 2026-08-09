import { createClient } from "@/lib/supabase/server"
import { getProjectTasks } from "@/lib/actions/tasks"
import { type LocationNode } from "@/lib/locations"
import { buildTaskScope, initialsFromEmail } from "@/lib/tasks/scope"
import { ProjectTasksPanelClient } from "./ProjectTasksPanelClient"
import type { KanbanTask } from "./TaskCard"
import type { FloorOption, ApartmentOption } from "./TaskForm"

interface Props {
  projectId: string
}

export async function ProjectTasksSidePanel({ projectId }: Props) {
  const supabase = await createClient()

  const [{ tasks, doneHasMore }, projectRes, floorsRes] = await Promise.all([
    getProjectTasks(projectId),
    supabase.from("projects").select("team_id").eq("id", projectId).single(),
    supabase
      .from("floors")
      .select("id, level, label")
      .eq("project_id", projectId)
      .order("level", { ascending: true }),
  ])

  const floors: FloorOption[] = floorsRes.data ?? []
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

  const apartments: ApartmentOption[] = locations
    .filter((l) => l.type === "apartment")
    .sort((a, b) => a.name.localeCompare(b.name, "pl", { numeric: true }))
    .map((l) => ({ id: l.id, name: l.name, floor_id: l.floor_id }))

  // Creator initials via team members RPC (no assignee field in schema)
  const initialsByUserId = new Map<string, { initials: string; email: string }>()
  if (projectRes.data?.team_id) {
    const { data: members } = await supabase.rpc("get_team_members_with_emails", {
      p_team_id: projectRes.data.team_id,
    })
    members?.forEach((m: { user_id: string; email: string }) => {
      initialsByUserId.set(m.user_id, {
        initials: initialsFromEmail(m.email),
        email: m.email,
      })
    })
  }

  const cardTasks: KanbanTask[] = tasks.map((t) => {
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

  return (
    <div className="rounded-xl border bg-card lg:sticky lg:top-[calc(3.5rem+1px)] lg:max-h-[calc(100vh-3.5rem-2rem)] lg:overflow-y-auto">
      <div className="border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">Zadania projektu</h2>
      </div>
      <div className="p-4">
        <ProjectTasksPanelClient
          projectId={projectId}
          tasks={cardTasks}
          floors={floors}
          apartments={apartments}
          doneHasMore={doneHasMore}
        />
      </div>
    </div>
  )
}
