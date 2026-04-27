"use client"

import { useOptimistic, useState, useTransition } from "react"
import { ChevronDownIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { updateIssueStatus, deleteIssue } from "@/lib/actions/issues"
import { StatusBadge } from "./StatusBadge"
import { SeverityBadge } from "./SeverityBadge"
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
import type { IssueStatus, IssueSeverity } from "@/lib/types/db"

export type IssueRow = {
  id: string
  title: string
  description: string | null
  severity: IssueSeverity
  status: IssueStatus
  created_at: string
  resolved_at: string | null
}

type DialogState =
  | { type: "edit"; issue: IssueRow }
  | { type: "delete"; issue: IssueRow }
  | null

const STATUS_ORDER: Record<IssueStatus, number> = {
  open: 0,
  in_progress: 1,
  resolved: 2,
  rejected: 3,
}

const SEVERITY_ORDER: Record<IssueSeverity, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
}

const STATUS_SECTION_LABELS: Record<IssueStatus, string> = {
  open: "Otwarte",
  in_progress: "W trakcie",
  resolved: "Rozwiązane",
  rejected: "Odrzucone",
}

const NEXT_STATUS_LABELS: Record<IssueStatus, string> = {
  open: "Otwarta",
  in_progress: "W trakcie",
  resolved: "Rozwiązana",
  rejected: "Odrzucona",
}

const VALID_NEXT_STATUSES: Record<IssueStatus, IssueStatus[]> = {
  open: ["in_progress", "rejected"],
  in_progress: ["resolved", "rejected"],
  resolved: ["rejected"],
  rejected: [],
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

interface Props {
  issues: IssueRow[]
}

export function IssueListClient({ issues: initialIssues }: Props) {
  const [optimisticIssues, applyOptimistic] = useOptimistic(
    initialIssues,
    (
      state: IssueRow[],
      { id, status }: { id: string; status: IssueStatus }
    ) => state.map((i) => (i.id === id ? { ...i, status } : i))
  )
  const [dialog, setDialog] = useState<DialogState>(null)
  const [expandedSections, setExpandedSections] = useState<Set<IssueStatus>>(
    () => new Set<IssueStatus>(["open", "in_progress"])
  )
  const [, startTransition] = useTransition()

  function toggleSection(status: IssueStatus) {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  function handleStatusChange(issue: IssueRow, newStatus: IssueStatus) {
    startTransition(async () => {
      applyOptimistic({ id: issue.id, status: newStatus })
      const result = await updateIssueStatus(issue.id, newStatus)
      if (result.error) toast.error(result.error)
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
      }
    })
  }

  const sorted = [...optimisticIssues].sort((a, b) => {
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (s !== 0) return s
    const sv = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (sv !== 0) return sv
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
                  <span className="text-xs text-muted-foreground">
                    ({group.length})
                  </span>
                </span>
                <ChevronDownIcon
                  className={cn(
                    "size-4 text-muted-foreground transition-transform duration-150",
                    expanded && "rotate-180"
                  )}
                />
              </button>

              {expanded && (
                <ul className="divide-y border-t">
                  {group.map((issue) => (
                    <li key={issue.id} className="px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-medium leading-snug">
                              {issue.title}
                            </span>
                            <SeverityBadge severity={issue.severity} />
                          </div>
                          {issue.description && (
                            <p className="mb-1.5 text-xs text-muted-foreground">
                              {issue.description.length > 80
                                ? issue.description.slice(0, 80) + "…"
                                : issue.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {formatDate(issue.created_at)}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-0.5">
                          {nextStatuses.length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                className={cn(
                                  buttonVariants({ variant: "outline", size: "sm" }),
                                  "h-auto py-0.5 text-xs"
                                )}
                              >
                                Zmień status
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {nextStatuses.map((s) => (
                                  <DropdownMenuItem
                                    key={s}
                                    onClick={() => handleStatusChange(issue, s)}
                                  >
                                    <StatusBadge status={s} />
                                    <span>{NEXT_STATUS_LABELS[s]}</span>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}

                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDialog({ type: "edit", issue })}
                            aria-label="Edytuj"
                          >
                            <PencilIcon className="size-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDialog({ type: "delete", issue })}
                            aria-label="Usuń"
                          >
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

      {dialog?.type === "edit" && (
        <IssueForm
          mode="edit"
          issue={dialog.issue}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.type === "delete" && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null)
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Usuń usterkę</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Usunąć{" "}
              <strong>{dialog.issue.title}</strong>? Tej operacji nie można
              cofnąć.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>
                Anuluj
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDeleteConfirm(dialog.issue)}
              >
                Usuń
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
