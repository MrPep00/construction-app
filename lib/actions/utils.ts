import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logging/log-error"
import { User } from "@supabase/supabase-js"

export type ActionResponse<T> = {
  data?: T
  error?: string
}

export async function withAuth<T>(
  actionName: string,
  handler: (supabase: Awaited<ReturnType<typeof createClient>>, user: User) => Promise<ActionResponse<T>>,
  context?: Record<string, unknown>
): Promise<ActionResponse<T>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Nie zalogowany" }
    }

    return await handler(supabase, user)
  } catch (error) {
    await logError({
      error,
      actionName,
      context,
    })
    return { error: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie później." }
  }
}
