"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ChevronDownIcon, PencilIcon, Trash2Icon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { updateIssueStatus, deleteIssue } from "@/lib/actions/issues"
import { StatusBadge } from "./StatusBadge"
import { IssueForm } from "./IssueForm"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button"
import type { IssueStatus } from "@/lib/types/db"

export type IssueRow = {
  id: string
  title: string
  description: string | null
  contractor: string | null
  status: IssueStatus
  created_at: string
}

type Photo = { id: string; signedUrl: string; name: string }

type DialogState =
  | { type: "detail"; issue: IssueRow }
  | { type: "edit"; issue: IssueRow }
  | { type: "delete"; issue: IssueRow }
  | null

const STATUS_ORDER: Record<IssueStatus, number> = {
  open: 0,
  in_progress: 1,
  resolved: 2,
  rejected: 3,
}

const VALID_NEXT_STATUSES: Record<IssueStatus, IssueStatus[]> = {
  open: ["in_progress", "rejected"],
  in_progress: ["resolved", "rejected"],
  resolved: ["rejected"],
  rejected: [],
}

const NEXT_STATUS_LABELS: Record<IssueStatus, string> = {
  open: "Otwarta",
  in_progress: "W trakcie",
  resolved: "Rozwiązana",
  rejected: "Odrzucona",
}

const STATUS_SECTION_LABELS: Record<IssueStatus, string> = {
  open: "Otwarte",
  in_progress: "W trakcie",
  resolved: "Rozwiązane",
  rejected: "Odrzucone",
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pl-PL", {
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
  const [photos, setPhotos] = useState<Photo[] | null>(null)

  useState(() => {
    const supabase = createClient()
    supabase
      .from("files")
      .select("id, name, storage_path")
      .eq("issue_id", issue.id)
      .order("created_at")
      .then(async ({ data }) => {
        if (!data || data.length === 0) { setPhotos([]); return }
        const paths = data.map((f) => f.storage_path)
        const { data: signed } = await supabase.storage
          .from("files")
          .createSignedUrls(paths, 3600)
        const urlMap = new Map(signed?.map(({ path, signedUrl }) => [path, signedUrl]) ?? [])
        setPhotos(data.map((f) => ({ id: f.id, name: f.name, signedUrl: urlMap.get(f.storage_path) ?? "" })))
      })
  })

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
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
            {photos === null ? (
              <p className="text-xs text-muted-foreground">Ładowanie…</p>
            ) : photos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Brak zdjęć</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p) => (
                  <a key={p.id} href={p.signedUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={p.signedUrl}
                      alt={p.name}
                      className="aspect-square w-full rounded-md object-cover"
                    />
                  </a>
                ))}
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
  )
}

interface Props {
  issues: IssueRow[]
  locationId: string
}

export function IssueListClient({ issues: initialIssues, locationId }: Props) {
  const router = useRouter()
  const [optimisticIssues, setOptimisticIssues] = useState(initialIssues)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [expandedSections, setExpandedSections] = useState<Set<IssueStatus>>(
    () => new Set<IssueStatus>(["open", "in_progress"])
  )
  const [, startTransition] = useTransition()

  // Sync when server re-renders with new data
  useState(() => { setOptimisticIssues(initialIssues) })

  function toggleSection(status: IssueStatus) {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  function handleStatusChange(issue: IssueRow, newStatus: IssueStatus) {
    setOptimisticIssues((prev) => prev.map((i) => i.id === issue.id ? { ...i, status: newStatus } : i))
    startTransition(async () => {
      const result = await updateIssueStatus(issue.id, newStatus)
      if (result.error) {
        toast.error(result.error)
        setOptimisticIssues(initialIssues)
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
          const nextStatuses = VALID_NEXT_STATUSES[status]

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
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => setDialog({ type: "detail", issue })}
                        >
                          <p className="mb-0.5 text-sm font-medium leading-snug hover:text-primary">
                            {issue.title}
                          </p>
                          {issue.contractor && (
                            <p className="text-xs text-muted-foreground">{issue.contractor}</p>
                          )}
                          <div className="mt-1">
                            <span className="text-xs text-muted-foreground">{formatDate(issue.created_at)}</span>
                          </div>
                        </button>

                        <div className="flex shrink-0 items-center gap-0.5">
                          {nextStatuses.length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-auto py-0.5 text-xs")}>
                                Status
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {nextStatuses.map((s) => (
                                  <DropdownMenuItem key={s} onClick={() => handleStatusChange(issue, s)}>
                                    <StatusBadge status={s} />
                                    <span>{NEXT_STATUS_LABELS[s]}</span>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}

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
