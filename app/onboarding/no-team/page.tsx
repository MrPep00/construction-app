"use client"

import { useState } from "react"
import { SignOutButton } from "@/components/sign-out-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function NoTeamPage() {
  const [inviteUrl, setInviteUrl] = useState("")
  const [error, setError] = useState<string | null>(null)

  function handleGoToInvite() {
    setError(null)

    let path: string
    try {
      const url = new URL(inviteUrl, window.location.origin)
      path = url.pathname
    } catch {
      setError("Nieprawidłowy link zaproszeniowy.")
      return
    }

    const inviteIndex = path.indexOf("/invite/")
    if (inviteIndex === -1) {
      setError("Nieprawidłowy link zaproszeniowy.")
      return
    }

    window.location.href = path.slice(inviteIndex)
  }

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-4">
        <h1 className="text-xl font-semibold">Brak dostępu do zespołu</h1>
        <p className="text-muted-foreground">
          Poproś administratora o link zaproszeniowy. Jeśli masz link, wklej go
          poniżej lub otwórz bezpośrednio w przeglądarce.
        </p>

        <div className="space-y-1.5 text-left">
          <Input
            type="url"
            placeholder="https://... (link zaproszeniowy)"
            value={inviteUrl}
            onChange={(e) => setInviteUrl(e.target.value)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <Button className="w-full" onClick={handleGoToInvite}>
          Przejdź do zaproszenia
        </Button>

        <div className="border-t pt-4">
          <SignOutButton />
        </div>
      </div>
    </main>
  )
}
