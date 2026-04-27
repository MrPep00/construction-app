"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import type { IssueStatus, IssueSeverity } from "@/lib/types/db"

const severityEnum = z.enum(["low", "normal", "high", "critical"])
const statusEnum = z.enum(["open", "in_progress", "resolved", "rejected"])

const VALID_NEXT_STATUSES: Record<IssueStatus, IssueStatus[]> = {
  open: ["in_progress", "rejected"],
  in_progress: ["resolved", "rejected"],
  resolved: ["rejected"],
  rejected: [],
}

async function revalidateIssuePaths(
  supabase: Awaited<ReturnType<typeof createClient>>,
  locationId: string
) {
  const { data: loc } = await supabase
    .from("locations")
    .select("floor_id")
    .eq("id", locationId)
    .single()
  if (!loc) return

  const { data: floor } = await supabase
    .from("floors")
    .select("level, project_id")
    .eq("id", loc.floor_id)
    .single()
  if (!floor) return

  revalidatePath(`/projects/${floor.project_id}/floors/${floor.level}/${locationId}`)
  revalidatePath(`/projects/${floor.project_id}/floors/${floor.level}`)
  revalidatePath(`/projects/${floor.project_id}`)
}

export async function createIssue(input: {
  locationId: string
  title: string
  description?: string
  severity: IssueSeverity
}): Promise<{ data?: { id: string }; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Nie zalogowany" }

  const schema = z.object({
    locationId: z.string().uuid(),
    title: z.string().min(1, "Tytuł jest wymagany").max(200, "Tytuł za długi"),
    description: z.string().max(2000, "Opis za długi").optional(),
    severity: severityEnum,
  })
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }
  }

  const { data, error } = await supabase
    .from("issues")
    .insert({
      location_id: parsed.data.locationId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      severity: parsed.data.severity,
      status: "open",
    })
    .select("id")
    .single()

  if (error) return { error: error.message }

  await revalidateIssuePaths(supabase, parsed.data.locationId)
  return { data: { id: data.id } }
}

export async function updateIssueStatus(
  id: string,
  status: IssueStatus
): Promise<{ data?: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Nie zalogowany" }

  if (!z.string().uuid().safeParse(id).success) return { error: "Nieprawidłowe ID" }
  if (!statusEnum.safeParse(status).success) return { error: "Nieprawidłowy status" }

  const { data: issue } = await supabase
    .from("issues")
    .select("status, location_id")
    .eq("id", id)
    .single()

  if (!issue) return { error: "Usterka nie istnieje" }

  const validNext = VALID_NEXT_STATUSES[issue.status as IssueStatus] ?? []
  if (!validNext.includes(status)) {
    return { error: `Niedozwolone przejście: ${issue.status} → ${status}` }
  }

  const { error } = await supabase
    .from("issues")
    .update({
      status,
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
    })
    .eq("id", id)

  if (error) return { error: error.message }

  await revalidateIssuePaths(supabase, issue.location_id)
  return { data: true }
}

export async function updateIssue(
  id: string,
  fields: { title?: string; description?: string; severity?: IssueSeverity }
): Promise<{ data?: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Nie zalogowany" }

  if (!z.string().uuid().safeParse(id).success) return { error: "Nieprawidłowe ID" }

  const schema = z.object({
    title: z.string().min(1, "Tytuł jest wymagany").max(200).optional(),
    description: z.string().max(2000).optional(),
    severity: severityEnum.optional(),
  })
  const parsed = schema.safeParse(fields)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }
  }

  const { data: issue } = await supabase
    .from("issues")
    .select("location_id")
    .eq("id", id)
    .single()
  if (!issue) return { error: "Usterka nie istnieje" }

  const { error } = await supabase
    .from("issues")
    .update(parsed.data)
    .eq("id", id)

  if (error) return { error: error.message }

  await revalidateIssuePaths(supabase, issue.location_id)
  return { data: true }
}

export async function deleteIssue(
  id: string
): Promise<{ data?: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Nie zalogowany" }

  if (!z.string().uuid().safeParse(id).success) return { error: "Nieprawidłowe ID" }

  const { data: issue } = await supabase
    .from("issues")
    .select("location_id")
    .eq("id", id)
    .single()
  if (!issue) return { error: "Usterka nie istnieje" }

  const { error } = await supabase.from("issues").delete().eq("id", id)
  if (error) return { error: error.message }

  await revalidateIssuePaths(supabase, issue.location_id)
  return { data: true }
}
