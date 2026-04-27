import { createClient } from "@/lib/supabase/server"
import { TaskListClient, type TaskRow } from "./TaskListClient"

interface Props {
  projectId: string
  floorId?: string | null
}

export async function TaskList({ projectId, floorId }: Props) {
  const supabase = await createClient()

  let query = supabase
    .from("tasks")
    .select("id, title, description, status, priority, due_date, created_at")
    .eq("project_id", projectId)

  if (floorId) {
    query = query.eq("floor_id", floorId)
  } else {
    query = query.is("floor_id", null)
  }

  const { data } = await query

  const tasks: TaskRow[] = data ?? []

  return <TaskListClient tasks={tasks} projectId={projectId} floorId={floorId} />
}
