import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { LoginForm } from "@/app/(auth)/login/login-form"
import { AcceptButton } from "./AcceptButton"

// Public page — middleware allows unauthenticated access to /invite/*

type InvitationTokenResult = {
  team_id: string | null
  team_name: string | null
  valid: boolean
  reason: string | null
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  // Validate token (SECURITY DEFINER, accessible to anon)
  const { data: tokenData, error: tokenErr } = (await supabase
    .rpc("check_invitation_token", { p_token: token })
    .single()) as { data: InvitationTokenResult | null; error: unknown }

  // Invalid / revoked / expired
  if (tokenErr || !tokenData || !tokenData.valid) {
    const reason = tokenData?.reason ?? undefined
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-xl font-semibold">Zaproszenie nieważne</h1>
          <p className="text-muted-foreground">
            {reason === "revoked"
              ? "To zaproszenie zostało odwołane."
              : reason === "expired"
                ? "To zaproszenie wygasło."
                : "Nie znaleziono zaproszenia."}
          </p>
          <p className="text-sm text-muted-foreground">
            Skontaktuj się z osobą, która Cię zaprosiła, aby otrzymać nowy link.
          </p>
        </div>
      </main>
    )
  }

  const teamName = tokenData.team_name ?? "zespołu"

  // Check if user is logged in
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Not logged in → show login form, redirect back after auth
  if (!user) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center space-y-1">
            <h1 className="text-xl font-semibold">Zaproszenie do zespołu</h1>
            <p className="text-muted-foreground">
              Zostałeś(aś) zaproszony(a) do zespołu{" "}
              <strong>{teamName}</strong>.
            </p>
            <p className="text-sm text-muted-foreground">
              Zaloguj się, aby dołączyć.
            </p>
          </div>
          <LoginForm callbackNext={`/invite/${token}`} />
        </div>
      </main>
    )
  }

  // Logged in — check existing team membership
  const { data: existing } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle()

  if (existing) {
    if (existing.team_id === tokenData.team_id) {
      // Already in this exact team
      return (
        <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
          <div className="max-w-sm text-center space-y-3">
            <h1 className="text-xl font-semibold">Jesteś już w zespole</h1>
            <p className="text-muted-foreground">
              Twoje konto jest już członkiem zespołu{" "}
              <strong>{teamName}</strong>.
            </p>
            <Link
              href="/projects"
              className="inline-block text-sm text-primary underline underline-offset-4"
            >
              Przejdź do projektów →
            </Link>
          </div>
        </main>
      )
    }

    // In a different team
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-xl font-semibold">Jesteś już w innym zespole</h1>
          <p className="text-muted-foreground">
            W obecnej wersji aplikacji można należeć tylko do jednego zespołu.
            Skontaktuj się z administratorem.
          </p>
        </div>
      </main>
    )
  }

  // Not in any team → show join button
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
      <div className="max-w-sm text-center space-y-4">
        <h1 className="text-xl font-semibold">Dołącz do zespołu</h1>
        <p className="text-muted-foreground">
          Witaj, <strong>{user.email}</strong>! Czy chcesz dołączyć do zespołu{" "}
          <strong>{teamName}</strong>?
        </p>
        <AcceptButton token={token} />
      </div>
    </main>
  )
}
