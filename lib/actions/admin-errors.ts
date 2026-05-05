"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth/admin-check"
import { updateAdminError } from "@/lib/supabase/admin-context"

export async function markErrorResolved(
  id: string,
  note?: string
): Promise<{ data?: boolean; error?: string }> {
  try {
    await requireAdmin()
    const { error } = await updateAdminError(id, true, note)
    if (error) return { error: "Nie udało się oznaczyć błędu jako naprawionego" }
    revalidatePath("/admin/errors")
    return { data: true }
  } catch {
    return { error: "Brak dostępu" }
  }
}

export async function markErrorUnresolved(
  id: string
): Promise<{ data?: boolean; error?: string }> {
  try {
    await requireAdmin()
    const { error } = await updateAdminError(id, false)
    if (error) return { error: "Nie udało się cofnąć rozwiązania błędu" }
    revalidatePath("/admin/errors")
    return { data: true }
  } catch {
    return { error: "Brak dostępu" }
  }
}
