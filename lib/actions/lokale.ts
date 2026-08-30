"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logging/log-error"
import { MAX_MATRIX_LABEL_LENGTH } from "@/lib/lokale"

/** Root folder a new lokal is filed under. "Mieszkania" is the pre-024 seed
 *  name — kept as a fallback for floors whose folder was never backfilled. */
const UNIT_FOLDER_NAMES = ["Lokale", "Mieszkania"]

const nameField = z
  .string()
  .trim()
  .min(1, "Nazwa jest wymagana")
  .max(100, "Nazwa może mieć najwyżej 100 znaków")

const matrixLabelField = z
  .string()
  .trim()
  .max(
    MAX_MATRIX_LABEL_LENGTH,
    `Skrót może mieć najwyżej ${MAX_MATRIX_LABEL_LENGTH} znaków`
  )

const categoryField = z.enum([
  "residential",
  "commercial",
  "storage",
  "technical",
])

const createUnitSchema = z.object({
  floorId: z.string().uuid(),
  name: nameField,
  category: categoryField,
  matrixLabel: matrixLabelField,
})

/** Creates a lokal (locations.type = 'apartment') under the floor's "Lokale"
 *  folder. Team access is enforced by RLS — a floor the user cannot read
 *  comes back empty. Any team member may create; no admin check (same as
 *  issues). */
export async function createUnit(input: {
  floorId: string
  name: string
  category: string
  matrixLabel: string
}): Promise<{ data?: { id: string }; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    const parsed = createUnitSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }
    }
    const { floorId, name, category, matrixLabel } = parsed.data

    const { data: floor } = await supabase
      .from("floors")
      .select("level, project_id, kind")
      .eq("id", floorId)
      .single()

    if (!floor) return { error: "Piętro niedostępne" }
    if (floor.kind === "zone") {
      return { error: "Strefy nie mają lokali" }
    }

    const { data: folders } = await supabase
      .from("locations")
      .select("id, name, sort_order")
      .eq("floor_id", floorId)
      .is("parent_id", null)
      .eq("type", "folder")
      .in("name", UNIT_FOLDER_NAMES)
      .order("sort_order")

    const folder = folders?.[0]
    if (!folder) return { error: "Brak folderu „Lokale” na tym piętrze" }

    const { data: siblings } = await supabase
      .from("locations")
      .select("sort_order")
      .eq("parent_id", folder.id)
      .order("sort_order", { ascending: false })
      .limit(1)

    const { data, error } = await supabase
      .from("locations")
      .insert({
        floor_id: floorId,
        parent_id: folder.id,
        name,
        type: "apartment",
        sort_order: (siblings?.[0]?.sort_order ?? 0) + 1,
        unit_category: category,
        matrix_label: matrixLabel === "" ? null : matrixLabel,
      })
      .select("id")
      .single()

    if (error) return { error: error.message }

    revalidatePath(`/projects/${floor.project_id}/floors/${floor.level}`)
    revalidatePath(`/projects/${floor.project_id}`)
    revalidatePath(`/projects/${floor.project_id}`, "layout")
    return { data: { id: data.id } }
  } catch (error) {
    await logError({
      error,
      actionName: "createUnit",
      context: { floorId: input.floorId, category: input.category },
    })
    return { error: "Nie udało się dodać lokalu" }
  }
}
