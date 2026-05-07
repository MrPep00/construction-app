"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface LoginFormProps {
  // When provided, the magic-link callback will redirect to this path
  // instead of the default /projects. Used by /invite/[token] pages.
  callbackNext?: string
}

export function LoginForm({ callbackNext }: LoginFormProps = {}) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get("error") === "auth_failed") {
      toast.error("Link logowania wygasł lub jest nieprawidłowy. Spróbuj ponownie.")
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const callbackUrl = callbackNext
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(callbackNext)}`
      : `${window.location.origin}/auth/callback`

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl,
        shouldCreateUser: true,
      },
    })

    setLoading(false)

    if (error) {
      toast.error(error.message || "Nie udało się wysłać linku. Sprawdź adres email i spróbuj ponownie.")
      return
    }

    setSent(true)
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Logowanie</CardTitle>
        <CardDescription>
          Wpisz swój email, aby otrzymać link logowania.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="space-y-1.5 text-sm">
            <p className="font-medium text-foreground">
              Sprawdź email — link logowania wysłany.
            </p>
            <p className="text-muted-foreground">
              Link wygasa po 1 godzinie.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Adres email</Label>
              <Input
                id="email"
                type="email"
                placeholder="ty@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Wysyłanie..." : "Wyślij link logowania"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
