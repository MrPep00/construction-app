"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const nameField = z
  .string()
  .min(1, "Nazwa jest wymagana")
  .max(100, "Nazwa może mieć najwyżej 100 znaków")

const createLocationSchema = z.object({
  floorId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  type: z.enum(["apartment", "room", "folder"]),
  name: nameField,
})

const renameLocationSchema = z.object({
  id: z.string().uuid(),
  name: nameField,
})

async function revalidateFloorByLocationId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  locationId: string
) {
  const { data } = await supabase
    .from("locations")
    .select("floors(level, project_id)")
    .eq("id", locationId)
    .single()

  const floor = (data?.floors as unknown as { level: number; project_id: string } | null)
  if (floor) {
    revalidatePath(`/projects/${floor.project_id}/floors/${floor.level}`)
  }
}

export async function createLocation(input: {
  floorId: string
  parentId: string | null
  type: "apartment" | "room" | "folder"
  name: string
}): Promise<{ data?: { id: string }; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Nie zalogowany" }

  const parsed = createLocationSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }
  }

  const { data: floor } = await supabase
    .from("floors")
    .select("level, project_id")
    .eq("id", parsed.data.floorId)
    .single()

  if (!floor) return { error: "Piętro nie istnieje" }

  // Compute next sort_order among siblings
  const siblingQuery = supabase
    .from("locations")
    .select("sort_order")
    .eq("floor_id", parsed.data.floorId)
    .order("sort_order", { ascending: false })
    .limit(1)

  const { data: siblings } = parsed.data.parentId
    ? await siblingQuery.eq("parent_id", parsed.data.parentId)
    : await siblingQuery.is("parent_id", null)

  const nextSort = (siblings?.[0]?.sort_order ?? 0) + 1

  const { data, error } = await supabase
    .from("locations")
    .insert({
      floor_id: parsed.data.floorId,
      parent_id: parsed.data.parentId,
      name: parsed.data.name,
      type: parsed.data.type,
      sort_order: nextSort,
    })
    .select("id")
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/projects/${floor.project_id}/floors/${floor.level}`)
  return { data: { id: data.id } }
}

export async function renameLocation(
  id: string,
  name: string
): Promise<{ data?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Nie zalogowany" }

  const parsed = renameLocationSchema.safeParse({ id, name })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }
  }

  const { error } = await supabase
    .from("locations")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.id)

  if (error) return { error: error.message }

  await revalidateFloorByLocationId(supabase, parsed.data.id)
  return { data: true }
}

export async function deleteLocation(
  id: string
): Promise<{ data?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Nie zalogowany" }

  if (!z.string().uuid().safeParse(id).success) {
    return { error: "Nieprawidłowe ID" }
  }

  // Capture floor info before deletion for revalidation
  await revalidateFloorByLocationId(supabase, id)

  const { error } = await supabase
    .from("locations")
    .delete()
    .eq("id", id)

  if (error) return { error: error.message }

  return { data: true }
}
