import { createClient } from "@/lib/supabase/server"

// All admin DB operations go through RPC functions that call
// set_config('app.admin_emails', ..., true) within the same Postgres
// transaction — so RLS policies using is_admin_email() can verify
// the caller is an admin without a separate roundtrip.

const getAdminEmails = () => process.env.ADMIN_EMAILS ?? ""

export type ErrorLog = {
  id: string
  occurred_at: string
  user_id: string | null
  user_email: string | null
  route: string | null
  action_name: string | null
  severity: "warn" | "error" | "fatal"
  message: string
  stack: string | null
  context: Record<string, unknown> | null
  user_agent: string | null
  resolved: boolean
  resolved_at: string | null
  resolved_note: string | null
}

export type ErrorStats = {
  total_unresolved: number
  today: number
  this_week: number
  count_warn: number
  count_error: number
  count_fatal: number
}

export async function fetchAdminErrors(params: {
  showResolved: boolean
  severity?: string | null
  userEmail?: string | null
}): Promise<{ data: ErrorLog[]; error: string | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("admin_get_error_logs", {
    p_admin_emails: getAdminEmails(),
    p_show_resolved: params.showResolved,
    p_severity: params.severity ?? null,
    p_user_email_filter: params.userEmail ?? null,
  })
  return { data: (data as ErrorLog[]) ?? [], error: error?.message ?? null }
}

export async function fetchAdminErrorStats(): Promise<{
  data: ErrorStats | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("admin_get_error_stats", {
    p_admin_emails: getAdminEmails(),
  })
  const row = Array.isArray(data) ? data[0] : null
  return {
    data: row
      ? {
          total_unresolved: Number(row.total_unresolved ?? 0),
          today: Number(row.today ?? 0),
          this_week: Number(row.this_week ?? 0),
          count_warn: Number(row.count_warn ?? 0),
          count_error: Number(row.count_error ?? 0),
          count_fatal: Number(row.count_fatal ?? 0),
        }
      : null,
    error: error?.message ?? null,
  }
}

export async function updateAdminError(
  id: string,
  resolved: boolean,
  note?: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc("admin_update_error_resolved", {
    p_admin_emails: getAdminEmails(),
    p_id: id,
    p_resolved: resolved,
    p_note: note ?? null,
  })
  return { error: error?.message ?? null }
}
