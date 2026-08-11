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
