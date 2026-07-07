"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withAuth } from "./utils"

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
}) {
  return withAuth("createLocation", async (supabase) => {
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
  }, { floorId: input.floorId, type: input.type })
}

export async function renameLocation(
  id: string,
  name: string
) {
  return withAuth("renameLocation", async (supabase) => {
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
  }, { locationId: id })
}

export async function moveLocationToTenantChanges(
  locationId: string,
  tenantChangesId: string
) {
  return withAuth("moveLocationToTenantChanges", async (supabase) => {
    if (
      !z.string().uuid().safeParse(locationId).success ||
      !z.string().uuid().safeParse(tenantChangesId).success
    ) {
      return { error: "Nieprawidłowe ID" }
    }

    const { data: loc } = await supabase
      .from("locations")
      .select("floor_id")
      .eq("id", locationId)
      .single()

    const { data: tc = null } = await supabase
      .from("locations")
      .select("floor_id")
      .eq("id", tenantChangesId)
      .eq("type", "folder")
      .single()

    if (!loc || !tc) return { error: "Lokalizacja nie istnieje" }
    if (loc.floor_id !== tc.floor_id) return { error: "Różne piętra — nie można przenieść" }

    const { error } = await supabase
      .from("locations")
      .update({ parent_id: tenantChangesId })
      .eq("id", locationId)

    if (error) return { error: error.message }

    await revalidateFloorByLocationId(supabase, locationId)
    return { data: true }
  }, { locationId, tenantChangesId })
}

export async function deleteLocation(
  id: string
) {
  return withAuth("deleteLocation", async (supabase) => {
    if (!z.string().uuid().safeParse(id).success) {
      return { error: "Nieprawidłowe ID" }
    }

    await revalidateFloorByLocationId(supabase, id)

    const { error } = await supabase
      .from("locations")
      .delete()
      .eq("id", id)

    if (error) return { error: error.message }

    return { data: true }
  }, { locationId: id })
}
