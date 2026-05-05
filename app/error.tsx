"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const reportedRef = useRef(false)

  useEffect(() => {
    if (reportedRef.current) return
    reportedRef.current = true

    console.error(error)

    fetch("/api/log-client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        route:
          typeof window !== "undefined" ? window.location.pathname : undefined,
      }),
    }).catch(() => {
      // Ignore — already console.errored above
    })
  }, [error])

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h2 className="text-xl font-semibold">Coś poszło nie tak.</h2>
      <p className="text-sm text-muted-foreground">
        Wystąpił nieoczekiwany błąd. Spróbuj ponownie.
      </p>
      <Button onClick={reset}>Spróbuj ponownie</Button>
    </main>
  )
}
