import { createClient } from "@/lib/supabase/server"

const SENSITIVE_KEY_RE =
  /^(password|token|secret|key|apikey|authorization|cookie)$/i

function sanitizeValue(
  val: unknown,
  depth = 0
): Record<string, unknown> | string | number | boolean | null | undefined {
  if (
    val === null ||
    typeof val === "string" ||
    typeof val === "number" ||
    typeof val === "boolean"
  ) {
    return val
  }
  if (depth > 1) return undefined
  if (
    typeof val === "object" &&
    !Array.isArray(val) &&
    !(val instanceof FormData) &&
    !(val instanceof File) &&
    !(val instanceof Blob) &&
    !(val instanceof ArrayBuffer) &&
    !(typeof Buffer !== "undefined" && val instanceof Buffer)
  ) {
    const nested: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (SENSITIVE_KEY_RE.test(k)) continue
      const sanitized = sanitizeValue(v, depth + 1)
      if (sanitized !== undefined) nested[k] = sanitized
    }
    return nested
  }
  return undefined
}

function sanitizeContext(
  ctx: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!ctx) return {}
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(ctx)) {
    if (SENSITIVE_KEY_RE.test(k)) continue
    const sanitized = sanitizeValue(v)
    if (sanitized !== undefined) result[k] = sanitized
  }
  return result
}

export async function logError({
  error,
  route,
  actionName,
  context,
  severity = "error",
  userAgent,
}: {
  error: unknown
  route?: string
  actionName?: string
  context?: Record<string, unknown>
  severity?: "warn" | "error" | "fatal"
  userAgent?: string
}): Promise<void> {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  console.error("[logError]", {
    severity,
    message,
    route,
    actionName,
    stack,
  })

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const sanitized = sanitizeContext(context)

    await supabase.from("error_logs").insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      route: route ?? null,
      action_name: actionName ?? null,
      severity,
      message: message.slice(0, 500),
      stack: stack?.slice(0, 2000) ?? null,
      context: sanitized,
      user_agent: userAgent ?? null,
    })
  } catch (logErr) {
    console.error("[logError] Failed to persist to DB:", logErr)
  }
}
