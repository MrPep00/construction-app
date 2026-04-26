import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)

  const pathname = request.nextUrl.pathname

  // Unauthenticated users can only access /login and /auth/*
  if (!user && !pathname.startsWith("/login") && !pathname.startsWith("/auth")) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    return NextResponse.redirect(loginUrl)
  }

  // Authenticated users visiting /login are sent to /projects
  if (user && pathname === "/login") {
    const projectsUrl = request.nextUrl.clone()
    projectsUrl.pathname = "/projects"
    return NextResponse.redirect(projectsUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
