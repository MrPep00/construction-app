"use client"

import { useEffect } from "react"

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.error("SW registration failed:", err))
    } else {
      // Dev: silently clean up any stale worker so cached builds never
      // mask local changes (covers all scopes, not just "/")
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          for (const registration of registrations) registration.unregister()
        })
        .catch(() => {})
    }
  }, [])

  return null
}
