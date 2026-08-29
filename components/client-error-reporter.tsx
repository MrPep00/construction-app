"use client"

import { useEffect } from "react"
import {
  classifyRejection,
  reportClientError,
} from "@/lib/logging/report-client-error"

/** Catches what the React error boundary in app/error.tsx cannot:
 *  errors thrown outside render (event handlers, timers) and rejected
 *  promises nobody awaited — which is where offline fetch failures
 *  actually surface. */
export function ClientErrorReporter() {
  useEffect(() => {
    // Same message twice in a row is almost always one fault retrying;
    // don't flood error_logs with it.
    let lastKey = ""
    let lastAt = 0

    function shouldReport(key: string): boolean {
      const now = Date.now()
      if (key === lastKey && now - lastAt < 5000) return false
      lastKey = key
      lastAt = now
      return true
    }

    function onError(event: ErrorEvent) {
      const error = event.error ?? event.message
      const key = `error:${event.message}`
      if (!shouldReport(key)) return
      reportClientError(error, "error")
    }

    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason
      const message = reason instanceof Error ? reason.message : String(reason)
      if (!shouldReport(`rejection:${message}`)) return
      reportClientError(reason, classifyRejection(reason))
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])

  return null
}
