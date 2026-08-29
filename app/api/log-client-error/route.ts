import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { logError } from "@/lib/logging/log-error"
import { isNetworkFailureMessage } from "@/lib/logging/network-errors"

const schema = z.object({
  message: z.string().min(1).max(500),
  stack: z.string().max(2000).optional(),
  route: z.string().max(500).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
})

/** new Error() here captures THIS file's server stack. Reporting that as
 *  the client's stack put fabricated /var/task frames on entries that
 *  never ran on the server, which misled diagnosis twice. */
const NO_CLIENT_STACK = "(no client stack — reconstructed at ingestion)"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)

    if (parsed.success) {
      const err = new Error(parsed.data.message)
      err.stack = parsed.data.stack ?? NO_CLIENT_STACK

      const context = parsed.data.context as
        | Record<string, unknown>
        | undefined

      // A network failure reported while the client was offline is a
      // connectivity blip, not a fault — keep it out of the error bucket.
      const offlineBlip =
        context?.online === false && isNetworkFailureMessage(parsed.data.message)

      const userAgent = request.headers.get("user-agent") ?? undefined
      await logError({
        error: err,
        route: parsed.data.route,
        context,
        severity: offlineBlip ? "warn" : "error",
        userAgent,
      })
    }
  } catch {
    // Swallow all errors — never leak details to client
  }

  // Always return 204 regardless of outcome
  return new NextResponse(null, { status: 204 })
}
