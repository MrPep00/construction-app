import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { SignOutButton } from "./sign-out-button"
import { isAdmin } from "@/lib/auth/admin-check"
import { fetchAdminErrorStats } from "@/lib/supabase/admin-context"

export async function Header() {
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
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="flex h-14 items-center justify-end gap-3 px-4">
        {adminUser && (
          <>
            <Link
              href="/team"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Zespół
            </Link>
            <Link
              href="/admin/errors"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Logi błędów
              {unresolvedCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">
                  {unresolvedCount}
                </span>
              )}
            </Link>
          </>
        )}
        <SignOutButton />
      </div>
    </header>
  )
}
