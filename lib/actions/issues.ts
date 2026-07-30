"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logging/log-error"

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
  // AppShell sidebar badge (open-issues count) lives in the project layout
  revalidatePath(`/projects/${floor.project_id}`, "layout")
}

export async function createIssue(input: {
  locationId: string
  title: string
  description?: string
  contractor?: string
}): Promise<{ data?: { id: string }; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    const schema = z.object({
      locationId: z.string().uuid(),
      title: z.string().min(1, "Krótki opis jest wymagany").max(200, "Opis za długi"),
      description: z.string().max(5000, "Opis za długi").optional(),
      contractor: z.string().max(200, "Nazwa za długa").optional(),
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
        contractor: parsed.data.contractor ?? null,
        status: "open",
        created_by: user.id,
      })
      .select("id")
      .single()

    if (error) return { error: error.message }

    await revalidateIssuePaths(supabase, parsed.data.locationId)
    return { data: { id: data.id } }
  } catch (error) {
    await logError({
      error,
      actionName: "createIssue",
      context: { locationId: input.locationId },
    })
    return { error: "Nie udało się dodać usterki" }
  }
}

export async function resolveIssue(
  id: string
): Promise<{ data?: boolean; error?: string }> {
  try {
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

    const { error } = await supabase
      .from("issues")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq("id", id)

    if (error) return { error: error.message }

    await revalidateIssuePaths(supabase, issue.location_id)
    return { data: true }
  } catch (error) {
    await logError({
      error,
      actionName: "resolveIssue",
      context: { issueId: id },
    })
    return { error: "Nie udało się rozwiązać usterki" }
  }
}

export async function reopenIssue(
  id: string
): Promise<{ data?: boolean; error?: string }> {
  try {
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

    const { error } = await supabase
      .from("issues")
      .update({ status: "open", resolved_at: null, resolved_by: null })
      .eq("id", id)

    if (error) return { error: error.message }

    await revalidateIssuePaths(supabase, issue.location_id)
    return { data: true }
  } catch (error) {
    await logError({
      error,
      actionName: "reopenIssue",
      context: { issueId: id },
    })
    return { error: "Nie udało się otworzyć usterki ponownie" }
  }
}

export async function updateIssue(
  id: string,
  fields: { title?: string; description?: string; contractor?: string }
): Promise<{ data?: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    if (!z.string().uuid().safeParse(id).success) return { error: "Nieprawidłowe ID" }

    const schema = z.object({
      title: z.string().min(1, "Krótki opis jest wymagany").max(200).optional(),
      description: z.string().max(5000).optional(),
      contractor: z.string().max(200).optional(),
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
  } catch (error) {
    await logError({
      error,
      actionName: "updateIssue",
      context: { issueId: id },
    })
    return { error: "Nie udało się zaktualizować usterki" }
  }
}

export async function deleteIssue(
  id: string
): Promise<{ data?: boolean; error?: string }> {
  try {
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
  } catch (error) {
    await logError({
      error,
      actionName: "deleteIssue",
      context: { issueId: id },
    })
    return { error: "Nie udało się usunąć usterki" }
  }
}
