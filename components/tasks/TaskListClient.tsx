"use client"

import { useOptimistic, useState, useTransition } from "react"
import { PencilIcon, Trash2Icon, PlusIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { updateTaskStatus, deleteTask } from "@/lib/actions/tasks"
import { TaskForm } from "./TaskForm"
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

function PriorityDots({ priority }: { priority: number }) {
  const filled = 6 - priority
  return (
    <span className="flex items-center gap-0.5" title={`Priorytet ${priority}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={cn(
            "inline-block size-1.5 rounded-full",
            i < filled
              ? priority === 1
                ? "bg-red-500"
                : priority === 2
                  ? "bg-orange-400"
                  : priority === 3
                    ? "bg-yellow-400"
                    : "bg-blue-400"
              : "bg-muted-foreground/25"
          )}
        />
      ))}
    </span>
  )
}

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
                {group.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-start gap-2 rounded-lg border bg-card px-3 py-2"
                  >
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
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <PriorityDots priority={task.priority} />
                        {task.due_date && (
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
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
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
                  </li>
                ))}
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
    </>
  )
}
