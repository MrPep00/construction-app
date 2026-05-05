import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const raw = process.env.ADMIN_EMAILS ?? ""
  if (!raw.trim()) return false
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .includes(email.toLowerCase())
}

export async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !isAdmin(user.email)) {
    redirect("/projects")
  }

  return user
}
