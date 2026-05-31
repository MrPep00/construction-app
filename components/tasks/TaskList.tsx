import { createClient } from "@/lib/supabase/server"
import { resolveFileUrls } from "@/lib/storage"
import { getFloorTasks } from "@/lib/actions/tasks"
import { TaskListClient, type TaskRow } from "./TaskListClient"
import type { FileItem } from "@/components/upload/FileGridClient"
import type { TaskStatus } from "@/lib/types/db"
import type { ApartmentOption } from "./TaskForm"

interface Props {
  projectId: string
  floorId?: string | null
}

export async function TaskList({ projectId, floorId }: Props) {
  const supabase = await createClient()

  type RawTask = {
    id: string
    title: string
    description: string | null
    status: string
    priority: number
    due_date: string | null
    created_at: string
    location_name?: string | null
    floor_label?: string | null
  }

  let rawTasks: RawTask[]
  let apartments: ApartmentOption[] = []

  if (floorId) {
    rawTasks = await getFloorTasks(floorId)
    const { data: aptsData } = await supabase
      .from("locations")
      .select("id, name, floor_id")
      .eq("floor_id", floorId)
      .eq("type", "apartment")
      .order("name")
    apartments = aptsData ?? []
  } else {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, description, status, priority, due_date, created_at")
      .eq("project_id", projectId)
      .is("floor_id", null)
      .is("location_id", null)
    rawTasks = data ?? []
  }

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
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status as TaskStatus,
    priority: t.priority,
    due_date: t.due_date,
    created_at: t.created_at,
    files: filesMap.get(t.id) ?? [],
    location_name: t.location_name ?? null,
    floor_label: t.floor_label ?? null,
  }))

  return <TaskListClient tasks={tasks} projectId={projectId} floorId={floorId} apartments={apartments} />
}
