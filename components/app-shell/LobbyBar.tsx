import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/auth/admin-check"
import { fetchAdminErrorStats } from "@/lib/supabase/admin-context"
import { SignOutButton } from "@/components/sign-out-button"
import { ThemeToggle } from "./ThemeToggle"

/** Slim top bar for routes outside a project (no sidebar): /projects, /team, /admin/* */
export async function LobbyBar() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const adminUser = isAdmin(user.email)

  let unresolvedCount = 0
  if (adminUser) {
    const { data } = await fetchAdminErrorStats()
    unresolvedCount = data?.total_unresolved ?? 0
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-6">
        <Link href="/projects" className="truncate text-sm font-semibold">
          Inspekcja Budowy
        </Link>

        <div className="flex items-center gap-2">
          {adminUser && (
            <>
              <Link
                href="/team"
                className="flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Zespół
              </Link>
              <Link
                href="/admin/errors"
                className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Logi błędów
                {unresolvedCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-white">
                    {unresolvedCount}
                  </span>
                )}
              </Link>
            </>
          )}
          <div className="w-11">
            <ThemeToggle collapsed />
          </div>
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
