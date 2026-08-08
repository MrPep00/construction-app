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
  // Display-level union in the Pliki tab: issue photos OR any image/* file
  issue_photo: "Zdjęcia",
}

export function isVisibleCategory(value: string | undefined | null): value is VisibleCategory {
  return VISIBLE_CATEGORIES.includes(value as VisibleCategory)
}

/** Categories a user can pick when uploading from the Pliki tab.
 *  'issue_photo' and 'task_file' are assigned by their flows, never picked. */
export const UPLOAD_CATEGORIES = ["documentation", "drawing", "protocol"] as const satisfies readonly FileCategory[]

export type UploadCategory = (typeof UPLOAD_CATEGORIES)[number]

export function isUploadCategory(value: string | undefined | null): value is UploadCategory {
  return UPLOAD_CATEGORIES.includes(value as UploadCategory)
}
