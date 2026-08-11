"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/auth/admin-check"
import { logError } from "@/lib/logging/log-error"

const createZoneSchema = z.object({
  projectId: z.string().uuid(),
  label: z
    .string()
    .min(1, "Nazwa jest wymagana")
    .max(100, "Nazwa może mieć najwyżej 100 znaków"),
  /** Insert below this floor/zone; null = top of the list */
  afterFloorId: z.string().uuid().nullable(),
})

/** Admin-only: insert a zone (kind='zone') into the project floor list.
 *  Zone level comes from the reserved range (-100, -101, ... — see migration
 *  023); sort_order of subsequent rows is shifted down. The shift runs as
 *  per-row updates (supabase-js has no expression updates / transactions);
 *  a failure mid-shift leaves a sort_order gap, which is harmless — ordering
 *  is relative. */
export async function createZone(input: {
  projectId: string
  label: string
  afterFloorId: string | null
}): Promise<{ data?: { id: string; level: number }; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }
    if (!isAdmin(user.email)) return { error: "Brak uprawnień" }

    const parsed = createZoneSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }
    }
    const { projectId, label, afterFloorId } = parsed.data

    // RLS verifies team membership — no rows means no access (or no project)
    const { data: floors, error: floorsError } = await supabase
      .from("floors")
      .select("id, level, sort_order")
      .eq("project_id", projectId)
    if (floorsError) return { error: floorsError.message }
    if (!floors || floors.length === 0) return { error: "Projekt niedostępny" }

    let position = 1
    if (afterFloorId) {
      const anchor = floors.find((f) => f.id === afterFloorId)
      if (!anchor) return { error: "Nieprawidłowa pozycja" }
      position = anchor.sort_order + 1
    }

    // Reserved-range level allocation (023 rule): min(-99, existing zone min) - 1
    const zoneLevels = floors.filter((f) => f.level <= -100).map((f) => f.level)
    const newLevel = (zoneLevels.length > 0 ? Math.min(...zoneLevels) : -99) - 1

    const toShift = floors.filter((f) => f.sort_order >= position)
    const shiftResults = await Promise.all(
      toShift.map((f) =>
        supabase
          .from("floors")
          .update({ sort_order: f.sort_order + 1 })
          .eq("id", f.id)
      )
    )
    const shiftError = shiftResults.find((r) => r.error)?.error
    if (shiftError) return { error: shiftError.message }

    const { data: zone, error: insertError } = await supabase
      .from("floors")
      .insert({
        project_id: projectId,
        level: newLevel,
        label,
        kind: "zone",
        sort_order: position,
      })
      .select("id, level")
      .single()
    if (insertError) return { error: insertError.message }

    // Floor list lives in the layout (AppShell/FAB) and on every project page
    revalidatePath(`/projects/${projectId}`, "layout")
    return { data: { id: zone.id, level: zone.level } }
  } catch (error) {
    await logError({
      error,
      actionName: "createZone",
      context: { projectId: input.projectId },
    })
    return { error: "Nie udało się dodać strefy" }
  }
}

const renameZoneSchema = z.object({
  floorId: z.string().uuid(),
  label: z
    .string()
    .min(1, "Nazwa jest wymagana")
    .max(100, "Nazwa może mieć najwyżej 100 znaków"),
})

/** Admin-only: rename a zone. Refuses kind='floor' rows — real floor labels
 *  are seeded and identity-coupled to shortFloorLabel(level). */
export async function renameZone(input: {
  floorId: string
  label: string
}): Promise<{ data?: { id: string }; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }
    if (!isAdmin(user.email)) return { error: "Brak uprawnień" }

    const parsed = renameZoneSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }
    }

    const { data: floor } = await supabase
      .from("floors")
      .select("id, kind, project_id")
      .eq("id", parsed.data.floorId)
      .single()
    if (!floor) return { error: "Strefa nie istnieje" }
    if (floor.kind !== "zone") return { error: "To nie jest strefa" }

    const { error: updateError } = await supabase
      .from("floors")
      .update({ label: parsed.data.label })
      .eq("id", floor.id)
    if (updateError) return { error: updateError.message }

    revalidatePath(`/projects/${floor.project_id}`, "layout")
    return { data: { id: floor.id } }
  } catch (error) {
    await logError({
      error,
      actionName: "renameZone",
      context: { floorId: input.floorId },
    })
    return { error: "Nie udało się zmienić nazwy strefy" }
  }
}

/** Admin-only: delete a zone. BLOCKED while the zone carries data
 *  (locations, floor-level files, tasks, notes) — the error message lists
 *  the counts. The seeded "Teren zewnętrzny" is deletable under the same
 *  rules (invariant by default, not by force). */
export async function deleteZone(input: {
  floorId: string
}): Promise<{ data?: { projectId: string }; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }
    if (!isAdmin(user.email)) return { error: "Brak uprawnień" }

    const parsed = z.object({ floorId: z.string().uuid() }).safeParse(input)
    if (!parsed.success) return { error: "Nieprawidłowe dane" }

    const { data: floor } = await supabase
      .from("floors")
      .select("id, kind, label, project_id")
      .eq("id", parsed.data.floorId)
      .single()
    if (!floor) return { error: "Strefa nie istnieje" }
    if (floor.kind !== "zone") return { error: "To nie jest strefa" }

    const countOn = (table: "locations" | "files" | "tasks" | "notes") =>
      supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("floor_id", floor.id)
    const [locationsRes, filesRes, tasksRes, notesRes] = await Promise.all([
      countOn("locations"),
      countOn("files"),
      countOn("tasks"),
      countOn("notes"),
    ])

    const blockers: string[] = []
    if (locationsRes.count) blockers.push(`lokalizacje: ${locationsRes.count}`)
    if (filesRes.count) blockers.push(`pliki: ${filesRes.count}`)
    if (tasksRes.count) blockers.push(`zadania: ${tasksRes.count}`)
    if (notesRes.count) blockers.push(`notatki: ${notesRes.count}`)
    if (blockers.length > 0) {
      return {
        error: `Nie można usunąć strefy „${floor.label}” — zawiera dane (${blockers.join(", ")}). Usuń je najpierw.`,
      }
    }

    const { error: deleteError } = await supabase
      .from("floors")
      .delete()
      .eq("id", floor.id)
    if (deleteError) return { error: deleteError.message }

    revalidatePath(`/projects/${floor.project_id}`, "layout")
    return { data: { projectId: floor.project_id } }
  } catch (error) {
    await logError({
      error,
      actionName: "deleteZone",
      context: { floorId: input.floorId },
    })
    return { error: "Nie udało się usunąć strefy" }
  }
}
