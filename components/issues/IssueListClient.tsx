"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronDownIcon, ImageIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { resolveIssue, reopenIssue, deleteIssue } from "@/lib/actions/issues"
import { StatusBadge } from "./StatusBadge"
import { IssueAttachmentBadge } from "./IssueAttachmentBadge"
import { Lightbox } from "@/components/upload/Lightbox"
import { IssueForm } from "./IssueForm"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { IssueStatus } from "@/lib/types/db"
import type { IssuePhoto } from "@/lib/issue-photos"
import { formatTimestampPl } from "@/lib/dates"

export type IssueRow = {
  id: string
  title: string
  description: string | null
  contractor: string | null
  status: IssueStatus
  created_at: string
  /** Ordered (created_at asc), URLs pre-resolved server-side */
  photos: IssuePhoto[]
}

type DialogState =
  | { type: "detail"; issue: IssueRow }
  | { type: "edit"; issue: IssueRow }
  | { type: "delete"; issue: IssueRow }
  | null

const STATUS_ORDER: Record<IssueStatus, number> = {
  open: 0,
  resolved: 1,
}

function formatDate(dateStr: string) {
  return formatTimestampPl(new Date(dateStr), {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function IssueDetailDialog({
  issue,
  onClose,
  onEdit,
}: {
  issue: IssueRow
  onClose: () => void
  onEdit: () => void
}) {
  const photos = issue.photos
  // Only photos with a resolved URL are viewable; lightboxIndex indexes THIS list.
  const viewable = photos.filter((p) => p.url)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  return (
    <>
    <Dialog
      open
      onOpenChange={(open, details) => {
        if (open) return
        // Base UI (not Radix): dismissal is cancelled through the change event —
        // there is no onEscapeKeyDown/onPointerDownOutside. Base UI also stops
        // propagation of the Escape keydown, so the Lightbox's own window listener
        // never sees it while the dialog owns the key; the dialog therefore closes
        // the Lightbox itself. Net effect: 1st Escape closes only the Lightbox,
        // 2nd closes the dialog.
        if (lightboxIndex !== null) {
          if (details.reason === "escape-key") {
            details.cancel()
            setLightboxIndex(null)
            return
          }
          // Every click inside the Lightbox (backdrop, chevrons, thumbs) lands
          // outside the dialog popup. Keep the dialog open and let the Lightbox
          // decide for itself whether that click means "close".
          if (details.reason === "outside-press" || details.reason === "focus-out") {
            details.cancel()
            return
          }
        }
        onClose()
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6 text-base leading-snug">{issue.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={issue.status} />
          </div>

          {issue.contractor && (
            <div>
              <p className="mb-0.5 text-xs font-medium text-muted-foreground">Podwykonawca</p>
              <p className="text-sm">{issue.contractor}</p>
            </div>
          )}

          {issue.description && (
            <div>
              <p className="mb-0.5 text-xs font-medium text-muted-foreground">Pełny opis</p>
              <p className="whitespace-pre-wrap text-sm">{issue.description}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">Zgłoszono: {formatDate(issue.created_at)}</p>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Zdjęcia</p>
            {photos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Brak zdjęć</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p) =>
                  p.url ? (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setLightboxIndex(viewable.findIndex((v) => v.id === p.id))}
                      aria-label={`Otwórz zdjęcie: ${p.name}`}
                    >
                      <img
                        src={p.url}
                        alt={p.name}
                        className="aspect-square w-full rounded-md object-cover"
                      />
                    </button>
                  ) : (
                    <span
                      key={p.id}
                      className="flex aspect-square w-full items-center justify-center rounded-md bg-muted text-muted-foreground/60"
                    >
                      <ImageIcon className="size-5" />
                    </span>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Zamknij</Button>
          <Button onClick={onEdit}>Edytuj</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Rendered outside <Dialog> on purpose: DialogContent is transformed, which
        would make a `fixed` overlay inside it position against the dialog box. */}
    {lightboxIndex !== null && (
      <Lightbox
        images={viewable.map((p) => ({
          src: p.url as string,
          filename: p.name,
          uploadedAt: p.createdAt,
        }))}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />
    )}
    </>
  )
}

interface Props {
  issues: IssueRow[]
  locationId: string
}

export function IssueListClient({ issues: initialIssues, locationId }: Props) {
  const router = useRouter()
  // Optimistic status per issue id, applied over the server-provided props.
  // Deriving at render (instead of copying props to state) keeps the list in
  // sync with parent updates — optimistic creates, router.refresh.
  const [statusOverrides, setStatusOverrides] = useState<Map<string, IssueStatus>>(
    () => new Map()
  )
  const [dialog, setDialog] = useState<DialogState>(null)
  const [expandedSections, setExpandedSections] = useState<Set<IssueStatus>>(
    () => new Set<IssueStatus>(["open"])
  )
  const [, startTransition] = useTransition()

  const optimisticIssues = initialIssues.map((issue) => {
    const override = statusOverrides.get(issue.id)
    return override && override !== issue.status
      ? { ...issue, status: override }
      : issue
  })

  function toggleSection(status: IssueStatus) {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  function handleStatusChange(issue: IssueRow, newStatus: IssueStatus) {
    setStatusOverrides((prev) => new Map(prev).set(issue.id, newStatus))
    startTransition(async () => {
      const result =
        newStatus === "resolved"
          ? await resolveIssue(issue.id)
          : await reopenIssue(issue.id)
      if (result.error) {
        toast.error(result.error)
        // Rollback: drop the override, server truth (props) wins again
        setStatusOverrides((prev) => {
          const copy = new Map(prev)
          copy.delete(issue.id)
          return copy
        })
      } else {
        router.refresh()
      }
    })
  }

  function handleDeleteConfirm(issue: IssueRow) {
    startTransition(async () => {
      const result = await deleteIssue(issue.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Usterka usunięta")
        setDialog(null)
        router.refresh()
      }
    })
  }

  const sorted = [...optimisticIssues].sort((a, b) => {
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (s !== 0) return s
    return b.created_at.localeCompare(a.created_at)
  })

  const orderedStatuses = Object.keys(STATUS_ORDER) as IssueStatus[]
  const grouped = new Map<IssueStatus, IssueRow[]>()
  for (const status of orderedStatuses) {
    const group = sorted.filter((i) => i.status === status)
    if (group.length > 0) grouped.set(status, group)
  }

  if (optimisticIssues.length === 0) {
    return <p className="text-sm text-muted-foreground">Brak usterek.</p>
  }

  return (
    <>
      <div className="space-y-2">
        {Array.from(grouped.entries()).map(([status, group]) => {
          const expanded = expandedSections.has(status)

          return (
            <section key={status} className="overflow-hidden rounded-lg border">
              <button
                type="button"
                onClick={() => toggleSection(status)}
                className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50"
              >
                <span className="flex items-center gap-2">
                  <StatusBadge status={status} />
                  <span className="text-xs text-muted-foreground">({group.length})</span>
                </span>
                <ChevronDownIcon className={cn("size-4 text-muted-foreground transition-transform duration-150", expanded && "rotate-180")} />
              </button>

              {expanded && (
                <ul className="divide-y border-t">
                  {group.map((issue) => (
                    <li key={issue.id} className="px-3 py-2.5">
                      {/* Text block takes the row; actions sit beside it and wrap
                          below (basis-40 floor on the text) when the panel is too
                          narrow for both — never overlap the title. */}
                      <div className="flex flex-wrap items-start gap-x-2.5 gap-y-1.5">
                        <button
                          type="button"
                          className="min-w-0 flex-1 basis-40 text-left"
                          onClick={() => setDialog({ type: "detail", issue })}
                        >
                          <p className="mb-0.5 break-words text-sm font-medium leading-snug hover:text-primary">
                            {issue.title}
                          </p>
                          {issue.contractor && (
                            <p className="break-words text-xs text-muted-foreground">{issue.contractor}</p>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-xs text-muted-foreground">{formatDate(issue.created_at)}</span>
                            <IssueAttachmentBadge count={issue.photos.length} />
                          </div>
                        </button>

                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-auto py-0.5 text-xs"
                            onClick={() =>
                              handleStatusChange(issue, issue.status === "open" ? "resolved" : "open")
                            }
                          >
                            {issue.status === "open" ? "Rozwiąż" : "Otwórz ponownie"}
                          </Button>

                          <Button variant="ghost" size="icon-sm" onClick={() => setDialog({ type: "edit", issue })} aria-label="Edytuj">
                            <PencilIcon className="size-3.5" />
                          </Button>

                          <Button variant="ghost" size="icon-sm" onClick={() => setDialog({ type: "delete", issue })} aria-label="Usuń">
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      {dialog?.type === "detail" && (
        <IssueDetailDialog
          issue={dialog.issue}
          onClose={() => setDialog(null)}
          onEdit={() => setDialog({ type: "edit", issue: dialog.issue })}
        />
      )}

      {dialog?.type === "edit" && (
        <IssueForm
          mode="edit"
          issue={dialog.issue}
          locationId={locationId}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.type === "delete" && (
        <Dialog open onOpenChange={(open) => { if (!open) setDialog(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Usuń usterkę</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Usunąć <strong>{dialog.issue.title}</strong>? Tej operacji nie można cofnąć.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>Anuluj</Button>
              <Button variant="destructive" onClick={() => handleDeleteConfirm(dialog.issue)}>Usuń</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
