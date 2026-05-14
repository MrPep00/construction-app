import { createClient } from "@/lib/supabase/server"
import { resolveFileUrls } from "@/lib/storage"
import { TaskListClient, type TaskRow } from "./TaskListClient"
import type { FileItem } from "@/components/upload/FileGridClient"

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
  const rawTasks = data ?? []

  const filesMap = new Map<string, FileItem[]>()

  if (rawTasks.length > 0) {
    const taskIds = rawTasks.map((t) => t.id)
    const { data: filesData } = await supabase
      .from("files")
      .select("id, name, mime_type, size_bytes, created_at, storage_path, storage_provider, task_id")
      .in("task_id", taskIds)
      .order("created_at", { ascending: true })

    if (filesData && filesData.length > 0) {
      const urlMap = await resolveFileUrls(
        filesData.map((f) => ({
          storage_path: f.storage_path,
          storage_provider: (f.storage_provider ?? "supabase") as "supabase" | "r2",
        })),
        supabase
      )

      for (const f of filesData) {
        if (!f.task_id) continue
        const fileItem: FileItem = {
          id: f.id,
          name: f.name,
          mime_type: f.mime_type,
          size_bytes: f.size_bytes,
          created_at: f.created_at,
          storage_path: f.storage_path,
          storage_provider: f.storage_provider ?? "supabase",
          signedUrl: urlMap.get(f.storage_path) ?? null,
        }
        const existing = filesMap.get(f.task_id) ?? []
        existing.push(fileItem)
        filesMap.set(f.task_id, existing)
      }
    }
  }

  const tasks: TaskRow[] = rawTasks.map((t) => ({
    ...t,
    files: filesMap.get(t.id) ?? [],
  }))

  return <TaskListClient tasks={tasks} projectId={projectId} floorId={floorId} />
}
