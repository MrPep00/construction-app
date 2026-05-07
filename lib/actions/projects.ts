"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logging/log-error"

const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, "Nazwa jest wymagana")
    .max(100, "Nazwa może mieć najwyżej 100 znaków"),
})

export async function createProject(formData: FormData) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    const parsed = createProjectSchema.safeParse({ name: formData.get("name") })
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" }
    }

    // Resolve the user's team — required by team-based RLS
    const { data: membership } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!membership) return { error: "Nie jesteś przypisany do żadnego zespołu" }

    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: parsed.data.name,
        owner_id: user.id,
        team_id: membership.team_id,
      })
      .select("id")
      .single()

    if (error) return { error: error.message }

    revalidatePath("/projects")
    return { data: { id: data.id } }
  } catch (error) {
    await logError({ error, actionName: "createProject" })
    return { error: "Nie udało się utworzyć projektu" }
  }
}

export async function deleteProject(id: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    const { error } = await supabase.from("projects").delete().eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/projects")
    return { data: true }
  } catch (error) {
    await logError({ error, actionName: "deleteProject", context: { projectId: id } })
    return { error: "Nie udało się usunąć projektu" }
  }
}
