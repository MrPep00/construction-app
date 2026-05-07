import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/projects"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Check if the user has team membership
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { count } = await supabase
          .from("team_members")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)

        // No team → send to onboarding (unless already going to /invite/*)
        if ((!count || count === 0) && !next.startsWith("/invite")) {
          return NextResponse.redirect(new URL("/onboarding/no-team", request.url))
        }
      }

      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_failed", request.url))
}
