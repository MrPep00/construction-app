import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"
import { isAdmin } from "@/lib/auth/admin-check"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow the client-error logging endpoint (no auth needed)
  if (pathname === "/api/log-client-error") {
    return NextResponse.next()
  }

  const { supabaseResponse, user } = await updateSession(request)

  // Public auth paths — no redirect
  if (
    pathname.startsWith("/auth") ||
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname === "/favicon.ico"
  ) {
    return supabaseResponse
  }

  // Redirect authenticated users away from /login
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/projects"
    return NextResponse.redirect(url)
  }

  // Require authentication for all other routes
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Admin routes: require admin email
  if (pathname.startsWith("/admin")) {
    if (!isAdmin(user.email)) {
      const url = request.nextUrl.clone()
      url.pathname = "/projects"
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|icons/|sw\\.js|\\.well-known/).*)",
  ],
}
