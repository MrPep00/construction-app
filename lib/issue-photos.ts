import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveFileUrls } from "@/lib/storage"

export type IssuePhoto = {
  id: string
  name: string
  url: string | null
}

/**
 * All image files per issue, chronological (created_at asc). One query for the
 * whole id batch + one provider-aware URL resolve — no per-row fetches.
 * Returns Map<issue_id, IssuePhoto[]>; issues without photos are absent.
 */
export async function fetchIssuePhotos(
  supabase: SupabaseClient,
  issueIds: string[]
): Promise<Map<string, IssuePhoto[]>> {
  const byIssue = new Map<string, IssuePhoto[]>()
  if (issueIds.length === 0) return byIssue

  const { data } = await supabase
    .from("files")
    .select("id, issue_id, name, storage_path, storage_provider")
    .in("issue_id", issueIds)
    .like("mime_type", "image/%")
    .order("created_at", { ascending: true })

  const files = data ?? []
  if (files.length === 0) return byIssue

  const urls = await resolveFileUrls(
    files.map((f) => ({
      storage_path: f.storage_path,
      storage_provider: (f.storage_provider ?? "supabase") as "supabase" | "r2",
    })),
    supabase
  )

  files.forEach((f) => {
    if (!f.issue_id) return
    const list = byIssue.get(f.issue_id) ?? []
    list.push({ id: f.id, name: f.name, url: urls.get(f.storage_path) ?? null })
    byIssue.set(f.issue_id, list)
  })
  return byIssue
}
