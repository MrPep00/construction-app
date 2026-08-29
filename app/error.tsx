"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { reportClientError } from "@/lib/logging/report-client-error"

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

    reportClientError(error, "error")
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
