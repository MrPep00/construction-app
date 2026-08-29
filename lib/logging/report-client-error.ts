import { isNetworkFailureMessage } from "./network-errors"

/** Mirrors the zod caps in app/api/log-client-error/route.ts. Over-long
 *  fields used to fail safeParse, which silently dropped the whole
 *  report — truncate here so the entry always lands. */
const MESSAGE_MAX = 500
const STACK_MAX = 2000

export type ClientErrorType = "fetch" | "error" | "unhandledrejection"

export function reportClientError(
  error: unknown,
  type: ClientErrorType
): void {
  const err = error instanceof Error ? error : undefined
  const message = (err?.message ?? String(error)) || "Unknown client error"

  const body = {
    message: message.slice(0, MESSAGE_MAX),
    stack: err?.stack?.slice(0, STACK_MAX),
    route: typeof window !== "undefined" ? window.location.pathname : undefined,
    context: {
      online: typeof navigator !== "undefined" ? navigator.onLine : true,
      errorName: err?.name,
      type,
    },
  }

  try {
    void fetch("/api/log-client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {
      // Offline or the beacon itself failed — nothing more we can do
      // without recursing into this same reporter.
    })
  } catch {
    // JSON.stringify or fetch threw synchronously — swallow.
  }
}

/** An unhandled rejection carrying a network-failure message is a
 *  dropped request, not a logic bug — tag it so ingestion and the admin
 *  view can tell the two apart. */
export function classifyRejection(reason: unknown): ClientErrorType {
  const message = reason instanceof Error ? reason.message : String(reason)
  return isNetworkFailureMessage(message) ? "fetch" : "unhandledrejection"
}
