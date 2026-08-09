import { createClient } from "@/lib/supabase/server"
import { getProjectTasks } from "@/lib/actions/tasks"
import { TaskListClient, type TaskRow } from "./TaskListClient"
import type { FloorOption, ApartmentOption } from "./TaskForm"

interface Props {
  projectId: string
}

export async function ProjectTasksSidePanel({ projectId }: Props) {
  const supabase = await createClient()
  const { tasks } = await getProjectTasks(projectId)

  const { data: floorsData } = await supabase
    .from("floors")
    .select("id, level, label")
    .eq("project_id", projectId)
    .order("level", { ascending: true })

  const floors: FloorOption[] = floorsData ?? []
  const floorIds = floors.map((f) => f.id)

  let apartments: ApartmentOption[] = []
  if (floorIds.length > 0) {
    const { data: aptsData } = await supabase
      .from("locations")
      .select("id, name, floor_id")
      .in("floor_id", floorIds)
      .eq("type", "apartment")
      .order("name")
    apartments = aptsData ?? []
  }

  const taskRows: TaskRow[] = tasks.map((t) => ({
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
  }))

  return (
    <div className="rounded-xl border bg-card lg:sticky lg:top-[calc(3.5rem+1px)] lg:max-h-[calc(100vh-3.5rem-2rem)] lg:overflow-y-auto">
      <div className="border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">Zadania projektu</h2>
      </div>
      <div className="p-4">
        <TaskListClient
          tasks={taskRows}
          projectId={projectId}
          floors={floors}
          apartments={apartments}
        />
      </div>
    </div>
  )
}
