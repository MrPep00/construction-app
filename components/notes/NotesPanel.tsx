import { createClient } from "@/lib/supabase/server"
import { NotesPanelClient, type NoteRow } from "./NotesPanelClient"

interface Props {
  projectId: string
  floorId?: string | null
}

export async function NotesPanel({ projectId, floorId }: Props) {
  const supabase = await createClient()

  let query = supabase
    .from("notes")
    .select("id, body, created_at, updated_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })

  if (floorId) {
    query = query.eq("floor_id", floorId)
  } else {
    query = query.is("floor_id", null)
  }

  const { data } = await query

  const notes: NoteRow[] = data ?? []

  return <NotesPanelClient notes={notes} projectId={projectId} floorId={floorId} />
}
