"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDownIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { TaskStatus } from "@/lib/types/db"
import { taskStatusConfig } from "@/lib/status"
import { updateTaskStatus, deleteTask } from "@/lib/actions/tasks"
import { compareActiveTasks, compareDoneTasks } from "@/lib/tasks/scope"
import { TaskCard, type KanbanTask } from "./TaskCard"
import { TaskForm, type FloorOption, type ApartmentOption } from "./TaskForm"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

type CardDialog =
  | { type: "create" }
  | { type: "edit"; task: KanbanTask }
  | { type: "delete"; task: KanbanTask }
  | null

/** Dashboard side panel list on the shared TaskCard language:
 *  todo/doing expanded, Zrobione collapsed; done capped server-side
 *  (Pokaż więcej links to the full tasks view). */
export function ProjectTasksPanelClient({
  projectId,
  tasks,
  floors,
  apartments,
  doneHasMore,
}: {
  projectId: string
  tasks: KanbanTask[]
  floors: FloorOption[]
  apartments: ApartmentOption[]
  doneHasMore: boolean
}) {
  const router = useRouter()

  // Same optimistic pattern as TasksKanbanClient: in-flight tasks keep their
  // optimistic status when server data refreshes
  const [items, setItems] = useState(tasks)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const pendingIdsRef = useRef(pendingIds)
  useEffect(() => {
    pendingIdsRef.current = pendingIds
  }, [pendingIds])
  useEffect(() => {
    setItems((prev) =>
      tasks.map((task) => {
        if (!pendingIdsRef.current.has(task.id)) return task
        const local = prev.find((p) => p.id === task.id)
        return local ? { ...task, status: local.status } : task
      })
    )
  }, [tasks])

  const [dialog, setDialog] = useState<CardDialog>(null)
  const [doneOpen, setDoneOpen] = useState(false)

  async function moveTask(taskId: string, next: TaskStatus) {
    const current = items.find((t) => t.id === taskId)
    if (!current || current.status === next) return
    const previous = current.status

    setItems((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: next } : t))
    )
    setPendingIds((prev) => new Set(prev).add(taskId))

    const result = await updateTaskStatus(taskId, next)

    setPendingIds((prev) => {
      const copy = new Set(prev)
      copy.delete(taskId)
      return copy
    })

    if (result.error) {
      setItems((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: previous } : t))
      )
      toast.error(result.error)
    } else {
      router.refresh()
    }
  }

  function handleDeleteConfirm(task: KanbanTask) {
    void (async () => {
      const result = await deleteTask(task.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Zadanie usunięte")
        setDialog(null)
        router.refresh()
      }
    })()
  }

  const byStatus = (status: TaskStatus) =>
    items
      .filter((t) => t.status === status)
      .sort(status === "done" ? compareDoneTasks : compareActiveTasks)

  const doneTasks = byStatus("done")

  const cardProps = (task: KanbanTask) => ({
    task,
    pending: pendingIds.has(task.id),
    showCheckbox: true,
    onToggleDone: () =>
      void moveTask(task.id, task.status === "done" ? "todo" : "done"),
    onMove: (next: TaskStatus) => void moveTask(task.id, next),
    onEdit: () => setDialog({ type: "edit", task }),
    onDelete: () => setDialog({ type: "delete", task }),
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDialog({ type: "create" })}>
          <PlusIcon className="size-3.5" />
          Nowe zadanie
        </Button>
      </div>

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">Brak zadań.</p>
      )}

      {(["todo", "doing"] as TaskStatus[]).map((status) => {
        const group = byStatus(status)
        if (group.length === 0) return null
        const config = taskStatusConfig[status]
        return (
          <section key={status}>
            <header className="mb-2 flex items-center gap-2 px-1">
              <span className={cn("size-2 rounded-full", config.dotClass)} />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {config.label}
              </h3>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {group.length}
              </span>
            </header>
            <ul className="flex flex-col gap-2">
              {group.map((task) => (
                <TaskCard key={task.id} {...cardProps(task)} />
              ))}
            </ul>
          </section>
        )
      })}

      {(doneTasks.length > 0 || doneHasMore) && (
        <section>
          <button
            type="button"
            onClick={() => setDoneOpen((v) => !v)}
            aria-expanded={doneOpen}
            className="mb-2 flex w-full items-center gap-2 px-1"
          >
            <span
              className={cn("size-2 rounded-full", taskStatusConfig.done.dotClass)}
            />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {taskStatusConfig.done.label}
            </h3>
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">
              {doneTasks.length}
              {doneHasMore && "+"}
            </span>
            <ChevronDownIcon
              className={cn(
                "size-4 text-muted-foreground transition-transform duration-150",
                doneOpen && "rotate-180"
              )}
            />
          </button>

          {doneOpen && (
            <>
              <ul className="flex flex-col gap-2">
                {doneTasks.map((task) => (
                  <TaskCard key={task.id} {...cardProps(task)} />
                ))}
              </ul>
              {doneHasMore && (
                <Link
                  href={`/projects/${projectId}/tasks`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "mt-3 w-full"
                  )}
                >
                  Pokaż więcej
                </Link>
              )}
            </>
          )}
        </section>
      )}

      {dialog?.type === "create" && (
        <TaskForm
          mode="create"
          projectId={projectId}
          floors={floors}
          apartments={apartments}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.type === "edit" && (
        <TaskForm mode="edit" task={dialog.task} onClose={() => setDialog(null)} />
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
    </div>
  )
}
