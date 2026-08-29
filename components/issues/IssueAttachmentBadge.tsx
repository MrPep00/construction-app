import { ImageIcon } from "lucide-react"

/**
 * Passive photo-count pill for issue rows. Renders nothing at 0.
 * Non-interactive: no button, no focus, no propagation stop — row click
 * behaviour of the parent is untouched. Photo viewing lives in the detail view.
 */
export function IssueAttachmentBadge({ count }: { count: number }) {
  if (count <= 0) return null

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
      aria-label={`Zdjęcia: ${count}`}
    >
      <ImageIcon className="size-3.5" aria-hidden="true" />
      {count}
    </span>
  )
}
