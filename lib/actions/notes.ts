"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

async function revalidateNotePaths(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  floorId: string | null
) {
  revalidatePath(`/projects/${projectId}/notes`)
  revalidatePath(`/projects/${projectId}`)
  if (floorId) {
    const { data: floor } = await supabase
      .from("floors")
      .select("level")
      .eq("id", floorId)
      .single()
    if (floor) {
      revalidatePath(`/projects/${projectId}/floors/${floor.level}`)
    }
  }
}

export async function createNote(input: {
  projectId: string
  floorId?: string | null
  content: string
}): Promise<{ data?: { id: string }; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Nie zalogowany" }

  const schema = z.object({
    projectId: z.string().uuid(),
    floorId: z.string().uuid().nullable().optional(),
    content: z.string().min(1, "Treść jest wymagana").max(5000, "Treść za długa"),
  })
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }
  }

  const { data, error } = await supabase
    .from("notes")
    .insert({
      project_id: parsed.data.projectId,
      floor_id: parsed.data.floorId ?? null,
      body: parsed.data.content,
      created_by: user.id,
    })
    .select("id")
    .single()

  if (error) return { error: error.message }

  await revalidateNotePaths(supabase, parsed.data.projectId, parsed.data.floorId ?? null)
  return { data: { id: data.id } }
}

export async function updateNote(
  id: string,
  content: string
): Promise<{ data?: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Nie zalogowany" }

  if (!z.string().uuid().safeParse(id).success) return { error: "Nieprawidłowe ID" }

  const parsed = z
    .string()
    .min(1, "Treść jest wymagana")
    .max(5000, "Treść za długa")
    .safeParse(content)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }
  }

  const { data: note } = await supabase
    .from("notes")
    .select("project_id, floor_id")
    .eq("id", id)
    .single()
  if (!note) return { error: "Notatka nie istnieje" }

  const { error } = await supabase.from("notes").update({ body: parsed.data }).eq("id", id)
  if (error) return { error: error.message }

  await revalidateNotePaths(supabase, note.project_id, note.floor_id)
  return { data: true }
}

export async function deleteNote(
  id: string
): Promise<{ data?: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Nie zalogowany" }

  if (!z.string().uuid().safeParse(id).success) return { error: "Nieprawidłowe ID" }

  const { data: note } = await supabase
    .from("notes")
    .select("project_id, floor_id")
    .eq("id", id)
    .single()
  if (!note) return { error: "Notatka nie istnieje" }

  const { error } = await supabase.from("notes").delete().eq("id", id)
  if (error) return { error: error.message }

  await revalidateNotePaths(supabase, note.project_id, note.floor_id)
  return { data: true }
}
