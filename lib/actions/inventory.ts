"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import type { MovementReason } from "@/lib/types/db"

const reasonEnum = z.enum(["delivery", "consumption", "correction"])

export async function createItem(input: {
  projectId: string
  name: string
  unit: string
  palletQty?: number
  initialFloorId?: string
  initialRequired?: number
}): Promise<{ data?: { id: string }; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    const schema = z.object({
      projectId: z.string().uuid(),
      name: z.string().min(1, "Nazwa jest wymagana").max(200, "Nazwa za długa"),
      unit: z.string().min(1, "Jednostka jest wymagana").max(20, "Jednostka za długa"),
      palletQty: z.number().int().min(1).optional(),
      initialFloorId: z.string().uuid().optional(),
      initialRequired: z.number().int().min(0).optional(),
    })
    const parsed = schema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }

    const { data: item, error: itemError } = await supabase
      .from("inventory_items")
      .insert({
        project_id: parsed.data.projectId,
        name: parsed.data.name,
        unit: parsed.data.unit,
        ...(parsed.data.palletQty != null ? { pallet_qty: parsed.data.palletQty } : {}),
      })
      .select("id")
      .single()

    if (itemError) return { error: itemError.message }

    if (parsed.data.initialFloorId) {
      await supabase.from("inventory_levels").insert({
        item_id: item.id,
        floor_id: parsed.data.initialFloorId,
        on_hand: 0,
        required: parsed.data.initialRequired ?? 0,
      })
    }

    revalidatePath(`/projects/${parsed.data.projectId}/inventory`)
    return { data: { id: item.id } }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nieoczekiwany błąd" }
  }
}

export async function deleteItem(id: string): Promise<{ data?: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    if (!z.string().uuid().safeParse(id).success) return { error: "Nieprawidłowe ID" }

    const { data: item } = await supabase
      .from("inventory_items")
      .select("project_id")
      .eq("id", id)
      .single()
    if (!item) return { error: "Pozycja nie istnieje" }

    const { error } = await supabase.from("inventory_items").delete().eq("id", id)
    if (error) return { error: error.message }

    revalidatePath(`/projects/${item.project_id}/inventory`)
    return { data: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nieoczekiwany błąd" }
  }
}

export async function updateRequired(input: {
  itemId: string
  floorId: string
  required: number
}): Promise<{ data?: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    const schema = z.object({
      itemId: z.string().uuid(),
      floorId: z.string().uuid(),
      required: z.number().int().min(0, "Zapotrzebowanie nie może być ujemne"),
    })
    const parsed = schema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }

    const { data: item } = await supabase
      .from("inventory_items")
      .select("id, project_id")
      .eq("id", parsed.data.itemId)
      .single()
    if (!item) return { error: "Pozycja nie istnieje" }

    const { error } = await supabase.from("inventory_levels").upsert(
      {
        item_id: parsed.data.itemId,
        floor_id: parsed.data.floorId,
        required: parsed.data.required,
      },
      { onConflict: "item_id,floor_id" }
    )
    if (error) return { error: error.message }

    revalidatePath(`/projects/${item.project_id}/inventory`)
    return { data: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nieoczekiwany błąd" }
  }
}

export async function recordMovement(input: {
  itemId: string
  floorId: string
  delta: number
  reason: MovementReason
  note?: string
}): Promise<{ data?: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    const schema = z.object({
      itemId: z.string().uuid(),
      floorId: z.string().uuid(),
      delta: z.number().int().refine((n) => n !== 0, "Ilość nie może wynosić 0"),
      reason: reasonEnum,
      note: z.string().max(500).optional(),
    })
    const parsed = schema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }

    const { data: item } = await supabase
      .from("inventory_items")
      .select("id, project_id")
      .eq("id", parsed.data.itemId)
      .single()
    if (!item) return { error: "Pozycja nie istnieje" }

    const { error: movErr } = await supabase.from("inventory_movements").insert({
      item_id: parsed.data.itemId,
      floor_id: parsed.data.floorId,
      delta: parsed.data.delta,
      reason: parsed.data.reason,
      note: parsed.data.note ?? null,
      created_by: user.id,
    })
    if (movErr) return { error: movErr.message }

    const { data: level } = await supabase
      .from("inventory_levels")
      .select("id, on_hand")
      .eq("item_id", parsed.data.itemId)
      .eq("floor_id", parsed.data.floorId)
      .single()

    if (level) {
      const { error: lvlErr } = await supabase
        .from("inventory_levels")
        .update({ on_hand: level.on_hand + parsed.data.delta })
        .eq("id", level.id)
      if (lvlErr) return { error: lvlErr.message }
    } else {
      const { error: lvlErr } = await supabase.from("inventory_levels").insert({
        item_id: parsed.data.itemId,
        floor_id: parsed.data.floorId,
        on_hand: parsed.data.delta,
        required: 0,
      })
      if (lvlErr) return { error: lvlErr.message }
    }

    revalidatePath(`/projects/${item.project_id}/inventory`)

    const { data: floor } = await supabase
      .from("floors")
      .select("level, project_id")
      .eq("id", parsed.data.floorId)
      .single()
    if (floor) {
      revalidatePath(`/projects/${floor.project_id}/floors/${floor.level}`)
    }

    return { data: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Nieoczekiwany błąd" }
  }
}
