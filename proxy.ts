import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"
import { isAdmin } from "@/lib/auth/admin-check"

// Paths accessible without any authentication
const UNAUTHENTICATED_OK = [
  "/auth",
  "/login",
  "/invite",
  "/api/log-client-error",
]

// Authenticated paths that skip the team-membership check
// (where users without a team are allowed — e.g. to join one)
const NO_TEAM_OK = [
  "/auth",
  "/login",
  "/invite",
  "/onboarding",
  "/api/log-client-error",
]

function isExempt(pathname: string, list: string[]) {
  return list.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const { supabaseResponse, user } = await updateSession(request)

  // Static/public paths — no further checks
  if (isExempt(pathname, UNAUTHENTICATED_OK)) {
    return supabaseResponse
  }

  // Redirect unauthenticated users to /login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from /login
  if (pathname === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/projects"
    return NextResponse.redirect(url)
  }

  // Admin-only routes (/admin/*)
  if (pathname.startsWith("/admin")) {
    if (!isAdmin(user.email)) {
      const url = request.nextUrl.clone()
      url.pathname = "/projects"
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Team membership check for all other authenticated routes
  if (!isExempt(pathname, NO_TEAM_OK)) {
    // Create a second client reusing the already-refreshed session cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {}, // already handled by updateSession
        },
      }
    )

    const { count } = await supabase
      .from("team_members")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)

    if (!count || count === 0) {
      const url = request.nextUrl.clone()
      url.pathname = "/onboarding/no-team"
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest\\.json|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
