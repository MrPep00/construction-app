"use client"

import { useOptimistic, useState, useTransition } from "react"
import { PencilIcon, Trash2Icon, PlusIcon, PaperclipIcon, ChevronDownIcon, FileTextIcon, FileIcon } from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { updateTaskStatus, deleteTask } from "@/lib/actions/tasks"
import { TaskForm } from "./TaskForm"
import { Lightbox } from "@/components/upload/Lightbox"
import type { FileItem } from "@/components/upload/FileGridClient"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { TaskStatus } from "@/lib/types/db"

export type TaskRow = {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: number
  due_date: string | null
  created_at: string
  files: FileItem[]
}

type DialogState =
  | { type: "create" }
  | { type: "edit"; task: TaskRow }
  | { type: "delete"; task: TaskRow }
  | null

const STATUS_SECTIONS: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "Do zrobienia" },
  { status: "doing", label: "W trakcie" },
  { status: "done", label: "Zrobione" },
]

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
  })
}

function isOverdue(dateStr: string) {
  return new Date(dateStr + "T00:00:00") < new Date(new Date().toDateString())
}

interface Props {
  tasks: TaskRow[]
  projectId: string
  floorId?: string | null
}

export function TaskListClient({ tasks: initialTasks, projectId, floorId }: Props) {
  const [optimisticTasks, applyOptimistic] = useOptimistic(
    initialTasks,
    (state: TaskRow[], { id, status }: { id: string; status: TaskStatus }) =>
      state.map((t) => (t.id === id ? { ...t, status } : t))
  )
  const [dialog, setDialog] = useState<DialogState>(null)
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set())
  const [lightboxFile, setLightboxFile] = useState<FileItem | null>(null)
  const [, startTransition] = useTransition()

  function handleToggleDone(task: TaskRow) {
    const newStatus: TaskStatus = task.status === "done" ? "todo" : "done"
    startTransition(async () => {
      applyOptimistic({ id: task.id, status: newStatus })
      const result = await updateTaskStatus(task.id, newStatus)
      if (result.error) toast.error(result.error)
    })
  }

  function handleDeleteConfirm(task: TaskRow) {
    startTransition(async () => {
      const result = await deleteTask(task.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Zadanie usunięte")
        setDialog(null)
      }
    })
  }

  function toggleExpand(taskId: string) {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  const sorted = [...optimisticTasks].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
    if (a.due_date) return -1
    if (b.due_date) return 1
    return b.created_at.localeCompare(a.created_at)
  })

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setDialog({ type: "create" })}>
            <PlusIcon className="size-3.5" />
            Nowe zadanie
          </Button>
        </div>

        {optimisticTasks.length === 0 && (
          <p className="text-sm text-muted-foreground">Brak zadań.</p>
        )}

        {STATUS_SECTIONS.map(({ status, label }) => {
          const group = sorted.filter((t) => t.status === status)
          if (group.length === 0) return null
          return (
            <section key={status}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label} ({group.length})
              </h3>
              <ul className="space-y-1">
                {group.map((task) => {
                  const isExpanded = expandedTaskIds.has(task.id)
                  const hasFiles = task.files.length > 0
                  return (
                    <li
                      key={task.id}
                      className="rounded-lg border bg-card"
                    >
                      <div className="flex items-start gap-2 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={task.status === "done"}
                          onChange={() => handleToggleDone(task)}
                          className="mt-0.5 size-4 cursor-pointer accent-primary"
                        />
                        <div className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "text-sm leading-snug",
                              task.status === "done" && "text-muted-foreground line-through"
                            )}
                          >
                            {task.title}
                          </span>
                          {task.due_date && (
                            <div className="mt-0.5">
                              <span
                                className={cn(
                                  "text-xs",
                                  task.status !== "done" && isOverdue(task.due_date)
                                    ? "font-medium text-destructive"
                                    : "text-muted-foreground"
                                )}
                              >
                                {formatDate(task.due_date)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          {hasFiles && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(task.id)}
                              className="flex items-center gap-0.5 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label={isExpanded ? "Zwiń pliki" : "Rozwiń pliki"}
                            >
                              <PaperclipIcon className="size-3.5" />
                              <span>{task.files.length}</span>
                              <ChevronDownIcon
                                className={cn(
                                  "size-3 transition-transform",
                                  isExpanded && "rotate-180"
                                )}
                              />
                            </button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDialog({ type: "edit", task })}
                            aria-label="Edytuj"
                          >
                            <PencilIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDialog({ type: "delete", task })}
                            aria-label="Usuń"
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        </div>
                      </div>

                      {isExpanded && hasFiles && (
                        <div className="border-t px-3 pb-3 pt-2">
                          <div className="flex flex-wrap gap-2">
                            {task.files.map((file) => {
                              const isImage = file.mime_type.startsWith("image/")
                              if (isImage && file.signedUrl) {
                                return (
                                  <button
                                    key={file.id}
                                    type="button"
                                    onClick={() => setLightboxFile(file)}
                                    className="relative size-16 shrink-0 overflow-hidden rounded-md border hover:opacity-90"
                                    aria-label={`Podgląd: ${file.name}`}
                                  >
                                    <Image
                                      src={file.signedUrl}
                                      alt={file.name}
                                      fill
                                      className="object-cover"
                                      sizes="64px"
                                    />
                                  </button>
                                )
                              }
                              const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
                              const isPdf = file.mime_type === "application/pdf" || ext === "pdf"
                              return (
                                <a
                                  key={file.id}
                                  href={file.signedUrl ?? "#"}
                                  download={file.name}
                                  className="flex items-center gap-1.5 rounded-md border bg-muted px-2 py-1.5 text-xs hover:bg-muted/80"
                                  aria-label={`Pobierz: ${file.name}`}
                                >
                                  {isPdf ? (
                                    <FileTextIcon className="size-3.5 shrink-0 text-red-500" />
                                  ) : (
                                    <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
                                  )}
                                  <span className="max-w-[120px] truncate">{file.name}</span>
                                </a>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>

      {dialog?.type === "create" && (
        <TaskForm
          mode="create"
          projectId={projectId}
          floorId={floorId}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.type === "edit" && (
        <TaskForm
          mode="edit"
          task={dialog.task}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.type === "delete" && (
        <Dialog open onOpenChange={(open) => { if (!open) setDialog(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Usuń zadanie</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Usunąć <strong>{dialog.task.title}</strong>? Tej operacji nie można cofnąć.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>
                Anuluj
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDeleteConfirm(dialog.task)}
              >
                Usuń
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {lightboxFile && lightboxFile.signedUrl && (
        <Lightbox
          src={lightboxFile.signedUrl}
          filename={lightboxFile.name}
          uploadedAt={lightboxFile.created_at}
          onClose={() => setLightboxFile(null)}
        />
      )}
    </>
  )
}
