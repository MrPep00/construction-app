import { createClient } from "@/lib/supabase/server"
import { IssueListClient, type IssueRow } from "./IssueListClient"

interface Props {
  locationId: string
}

export async function IssueList({ locationId }: Props) {
  const supabase = await createClient()

  const { data } = await supabase
    .from("issues")
    .select("id, title, description, severity, status, created_at, resolved_at")
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })

  const issues: IssueRow[] = data ?? []

  return <IssueListClient issues={issues} />
}
