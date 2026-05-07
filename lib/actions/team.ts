"use server"

import { randomBytes } from "crypto"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { isAdmin, requireAdmin } from "@/lib/auth/admin-check"
import { logError } from "@/lib/logging/log-error"

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export type TeamMember = {
  userId: string
  email: string
  joinedAt: string
  isAdmin: boolean
}

export type TeamWithMembers = {
  id: string
  name: string
  created_by: string
  members: TeamMember[]
}

export type ActiveInvitation = {
  id: string
  token: string
  expires_at: string
  team_id: string
}

type TeamRow = { id: string; name: string; created_by: string }

type InvitationTokenResult = {
  team_id: string | null
  team_name: string | null
  valid: boolean
  reason: string | null
}

// ----------------------------------------------------------------
// getCurrentTeam
// Returns the user's first team, or null if they have none.
// ----------------------------------------------------------------
export async function getCurrentTeam(): Promise<{
  data: { id: string; name: string; created_by: string } | null
}> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { data: null }

    const { data, error } = await supabase
      .from("team_members")
      .select("team_id, teams!inner(id, name, created_by)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error || !data) return { data: null }
    const team = (Array.isArray(data.teams) ? data.teams[0] : data.teams) as unknown as TeamRow
    return { data: team }
  } catch (error) {
    await logError({ error, actionName: "getCurrentTeam" })
    return { data: null }
  }
}

// ----------------------------------------------------------------
// getCurrentTeamWithMembers
// Returns team + member list with emails (via SECURITY DEFINER RPC).
// ----------------------------------------------------------------
export async function getCurrentTeamWithMembers(): Promise<{
  data: TeamWithMembers | null
  error?: string
}> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { data: null, error: "Nie zalogowany" }

    const { data: memberRow, error: memberErr } = await supabase
      .from("team_members")
      .select("team_id, teams!inner(id, name, created_by)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (memberErr) return { data: null, error: memberErr.message }
    if (!memberRow) return { data: null }

    const team = (Array.isArray(memberRow.teams) ? memberRow.teams[0] : memberRow.teams) as unknown as TeamRow

    const { data: members, error: rpcErr } = await supabase.rpc(
      "get_team_members_with_emails",
      { p_team_id: team.id }
    )

    if (rpcErr) return { data: null, error: rpcErr.message }

    return {
      data: {
        ...team,
        members: (members ?? []).map(
          (m: { user_id: string; email: string; joined_at: string }) => ({
            userId: m.user_id,
            email: m.email,
            joinedAt: m.joined_at,
            isAdmin: isAdmin(m.email),
          })
        ),
      },
    }
  } catch (error) {
    await logError({ error, actionName: "getCurrentTeamWithMembers" })
    return { data: null, error: "Nie udało się pobrać danych zespołu" }
  }
}

// ----------------------------------------------------------------
// listActiveInvitation
// Returns the single non-revoked, non-expired invitation for admin's team.
// ----------------------------------------------------------------
export async function listActiveInvitation(): Promise<{
  data: ActiveInvitation | null
}> {
  try {
    await requireAdmin()
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { data: null }

    const { data: memberRow } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!memberRow) return { data: null }

    const { data } = await supabase
      .from("team_invitations")
      .select("id, token, expires_at, team_id")
      .eq("team_id", memberRow.team_id)
      .eq("revoked", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    return { data: data ?? null }
  } catch (error) {
    await logError({ error, actionName: "listActiveInvitation" })
    return { data: null }
  }
}

// ----------------------------------------------------------------
// generateInvitationLink
// Admin-only. Revokes existing invitations, creates a new one.
// Returns the token; the client builds the full URL.
// ----------------------------------------------------------------
export async function generateInvitationLink(): Promise<{
  data?: { token: string; expiresAt: string }
  error?: string
}> {
  try {
    await requireAdmin()
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    const { data: memberRow } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!memberRow) return { error: "Nie znaleziono zespołu" }

    // Revoke all active invitations for this team
    await supabase
      .from("team_invitations")
      .update({ revoked: true, revoked_at: new Date().toISOString() })
      .eq("team_id", memberRow.team_id)
      .eq("revoked", false)

    const token = randomBytes(16).toString("hex")
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from("team_invitations")
      .insert({
        team_id: memberRow.team_id,
        token,
        expires_at: expiresAt,
        created_by: user.id,
      })
      .select("token, expires_at")
      .single()

    if (error) return { error: error.message }

    revalidatePath("/team")
    return { data: { token: data.token, expiresAt: data.expires_at } }
  } catch (error) {
    await logError({ error, actionName: "generateInvitationLink" })
    return { error: "Nie udało się wygenerować linku" }
  }
}

// ----------------------------------------------------------------
// revokeCurrentInvitation
// Admin-only. Marks all active invitations as revoked.
// ----------------------------------------------------------------
export async function revokeCurrentInvitation(): Promise<{
  data?: boolean
  error?: string
}> {
  try {
    await requireAdmin()
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    const { data: memberRow } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!memberRow) return { error: "Nie znaleziono zespołu" }

    const { error } = await supabase
      .from("team_invitations")
      .update({ revoked: true, revoked_at: new Date().toISOString() })
      .eq("team_id", memberRow.team_id)
      .eq("revoked", false)

    if (error) return { error: error.message }

    revalidatePath("/team")
    return { data: true }
  } catch (error) {
    await logError({ error, actionName: "revokeCurrentInvitation" })
    return { error: "Nie udało się odwołać zaproszenia" }
  }
}

// ----------------------------------------------------------------
// acceptInvitation
// Validates token and adds current user to the team.
// ----------------------------------------------------------------
export async function acceptInvitation(token: string): Promise<{
  data?: { teamId: string }
  error?: string
}> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    const { data: tokenResult, error: tokenErr } = (await supabase
      .rpc("check_invitation_token", { p_token: token })
      .single()) as { data: InvitationTokenResult | null; error: unknown }

    if (tokenErr || !tokenResult) return { error: "Nieprawidłowe zaproszenie" }
    if (!tokenResult.valid) return { error: tokenResult.reason ?? "invalid" }

    const teamId = tokenResult.team_id as string

    // Check if user is already in any team
    const { data: existing } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()

    if (existing) {
      if (existing.team_id === teamId) return { error: "already_in_this_team" }
      return { error: "already_in_team" }
    }

    // Get invitation id for audit trail
    const { data: invitation } = await supabase
      .from("team_invitations")
      .select("id")
      .eq("token", token)
      .maybeSingle()

    const { error: insertErr } = await supabase.from("team_members").insert({
      team_id: teamId,
      user_id: user.id,
      joined_via_invitation_id: invitation?.id ?? null,
    })

    if (insertErr) return { error: insertErr.message }

    revalidatePath("/projects")
    return { data: { teamId } }
  } catch (error) {
    await logError({ error, actionName: "acceptInvitation" })
    return { error: "Nie udało się dołączyć do zespołu" }
  }
}

// ----------------------------------------------------------------
// removeMember
// Admin-only. Cannot remove self or last member.
// ----------------------------------------------------------------
export async function removeMember(
  teamId: string,
  userId: string
): Promise<{ data?: boolean; error?: string }> {
  try {
    await requireAdmin()
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    if (userId === user.id) {
      return { error: "Nie możesz usunąć siebie z zespołu" }
    }

    const { count } = await supabase
      .from("team_members")
      .select("*", { count: "exact", head: true })
      .eq("team_id", teamId)

    if (!count || count <= 1) {
      return { error: "Nie można usunąć ostatniego członka zespołu" }
    }

    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", userId)

    if (error) return { error: error.message }

    revalidatePath("/team")
    return { data: true }
  } catch (error) {
    await logError({ error, actionName: "removeMember" })
    return { error: "Nie udało się usunąć członka z zespołu" }
  }
}
