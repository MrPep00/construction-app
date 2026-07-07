"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { withAuth } from "./utils"

const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, "Nazwa jest wymagana")
    .max(100, "Nazwa może mieć najwyżej 100 znaków"),
})

export async function createProject(formData: FormData) {
  return withAuth("createProject", async (supabase, user) => {
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
        team_id: membership.team_id,
      })
      .select("id")
      .single()

    if (error) return { error: error.message }

    revalidatePath("/projects")
    return { data: { id: data.id } }
  })
}

export async function deleteProject(id: string) {
  return withAuth("deleteProject", async (supabase) => {
    const { error } = await supabase.from("projects").delete().eq("id", id)

    if (error) return { error: error.message }

    revalidatePath("/projects")
    return { data: true }
  }, { projectId: id })
}
