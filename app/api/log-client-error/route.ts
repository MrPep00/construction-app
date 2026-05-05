import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { logError } from "@/lib/logging/log-error"

const schema = z.object({
  message: z.string().min(1).max(500),
  stack: z.string().max(2000).optional(),
  route: z.string().max(500).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)

    if (parsed.success) {
      const err = new Error(parsed.data.message)
      if (parsed.data.stack) err.stack = parsed.data.stack
      const userAgent = request.headers.get("user-agent") ?? undefined
      await logError({
        error: err,
        route: parsed.data.route,
        context: parsed.data.context as Record<string, unknown> | undefined,
        severity: "error",
        userAgent,
      })
    }
  } catch {
    // Swallow all errors — never leak details to client
  }

  // Always return 204 regardless of outcome
  return new NextResponse(null, { status: 204 })
}
