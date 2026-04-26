import { createClient } from "@/lib/supabase/server"
import { SignOutButton } from "./sign-out-button"

export async function Header() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="flex h-14 items-center justify-end px-4">
        <SignOutButton />
      </div>
    </header>
  )
}
