import type { FileCategory } from "@/lib/types/db"

/** Categories shown in the Pliki tab. 'task_file' is deliberately absent —
 *  task attachments belong to the task view (migration 021 contract). */
export const VISIBLE_CATEGORIES = [
  "drawing",
  "protocol",
  "documentation",
  "issue_photo",
] as const

export type VisibleCategory = (typeof VISIBLE_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<VisibleCategory, string> = {
  drawing: "Rysunki",
  protocol: "Protokoły",
  documentation: "Dokumentacja",
  issue_photo: "Zdjęcia usterek",
}

export function isVisibleCategory(value: string | undefined | null): value is VisibleCategory {
  return VISIBLE_CATEGORIES.includes(value as VisibleCategory)
}

/** Default category for a fresh upload from the Pliki tab. */
export function inferCategoryFromMime(mimeType: string, name: string): FileCategory {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  if (ext === "dwg" || ext === "dxf") return "drawing"
  if (mimeType.startsWith("image/")) return "documentation"
  return "documentation"
}
