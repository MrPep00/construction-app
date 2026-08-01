import { createClient } from "@/lib/supabase/server"
import { NotesPanelClient, type NoteRow } from "./NotesPanelClient"

interface Props {
  projectId: string
  floorId?: string | null
}

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

export async function NotesPanel({ projectId, floorId }: Props) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: project }, { data: floorsData }] = await Promise.all([
    supabase.from("projects").select("team_id").eq("id", projectId).single(),
    supabase.from("floors").select("id, level").eq("project_id", projectId),
  ])

  // Unified stream: without floorId ALL project notes (global + floor-tagged);
  // with floorId scoped to that floor (floor page tab).
  let query = supabase
    .from("notes")
    .select("id, body, floor_id, created_by, created_at, updated_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
  if (floorId) query = query.eq("floor_id", floorId)
  const { data: notesData } = await query

  const emailByUserId = new Map<string, string>()
  if (project?.team_id) {
    const { data: members } = await supabase.rpc("get_team_members_with_emails", {
      p_team_id: project.team_id,
    })
    members?.forEach((m: { user_id: string; email: string }) => {
      emailByUserId.set(m.user_id, m.email)
    })
  }

  const levelByFloorId = new Map((floorsData ?? []).map((f) => [f.id, f.level]))

  const notes: NoteRow[] = (notesData ?? []).map((n) => {
    const email = emailByUserId.get(n.created_by) ?? null
    return {
      id: n.id,
      body: n.body,
      created_at: n.created_at,
      updated_at: n.updated_at,
      floor_level: n.floor_id != null ? (levelByFloorId.get(n.floor_id) ?? null) : null,
      author_email: email,
      author_initials: email ? initialsFromEmail(email) : null,
    }
  })

  // Chips + composer scope options: only floors that actually carry notes, top floor first
  const floorIdsWithNotes = new Set(
    (notesData ?? []).map((n) => n.floor_id).filter((id): id is string => id !== null)
  )
  const floorOptions = floorId
    ? []
    : (floorsData ?? [])
        .filter((f) => floorIdsWithNotes.has(f.id))
        .map((f) => ({ id: f.id, level: f.level }))
        .sort((a, b) => b.level - a.level)

  const currentEmail = user?.email ?? null

  return (
    <NotesPanelClient
      notes={notes}
      projectId={projectId}
      floorId={floorId}
      floorOptions={floorOptions}
      currentAuthor={
        currentEmail
          ? { email: currentEmail, initials: initialsFromEmail(currentEmail) }
          : null
      }
    />
  )
}
