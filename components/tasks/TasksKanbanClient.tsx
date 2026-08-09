"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ChevronDownIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { TaskStatus } from "@/lib/types/db"
import { TASK_STATUSES, taskStatusConfig } from "@/lib/status"
import { updateTaskStatus, deleteTask } from "@/lib/actions/tasks"
import { compareActiveTasks, compareDoneTasks } from "@/lib/tasks/scope"
import type { TaskRow } from "./TaskListClient"
import { TaskForm, type FloorOption, type ApartmentOption } from "./TaskForm"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type KanbanTask = TaskRow & {
  scopeType: "global" | "floor" | "location"
  /** e.g. "Ogólne", "P3", "M31 · P3" */
  scopeLabel: string
  /** Floor the task belongs to (via location for location-scoped); null = global */
  effectiveFloorId: string | null
  /** Floor level for ordering (see lib/tasks/scope.ts); null = global */
  effectiveFloorLevel: number | null
  /** Apartment/location name for pl-numeric collation; null = global/floor scope */
  locationSortName: string | null
  initials: string | null
  creatorEmail: string | null
}

const ALL = "all"
const DONE_STEP = 100

type CardDialog = { type: "edit" | "delete"; task: KanbanTask } | null

function isOverdue(task: KanbanTask) {
  if (!task.due_date || task.status === "done") return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(task.due_date + "T00:00:00") < today
}

function formatDue(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
  })
}

export function TasksKanbanClient({
  projectId,
  tasks,
  floors,
  apartments,
  doneHasMore,
  doneLimit,
}: {
  projectId: string
  tasks: KanbanTask[]
  floors: FloorOption[]
  apartments: ApartmentOption[]
  doneHasMore: boolean
  doneLimit: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [floorId, setFloorId] = useState<string>(
    () => searchParams.get("floor") ?? ALL
  )

  function updateFloor(value: string) {
    setFloorId(value)
    const params = new URLSearchParams(searchParams)
    if (value !== ALL) params.set("floor", value)
    else params.delete("floor")
    router.replace(params.size > 0 ? `${pathname}?${params}` : pathname, {
      scroll: false,
    })
  }

  function showMoreDone() {
    const params = new URLSearchParams(searchParams)
    params.set("done", String(doneLimit + DONE_STEP))
    router.replace(`${pathname}?${params}`, { scroll: false })
  }

  // Local copy for optimistic moves; in-flight tasks keep their optimistic
  // status when server data refreshes (same pattern as GlobalIssuesClient)
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

  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [dialog, setDialog] = useState<CardDialog>(null)
  // "Zrobione" collapsed by default on both breakpoints (independent toggles)
  const [doneOpenDesktop, setDoneOpenDesktop] = useState(false)
  const [doneOpenMobile, setDoneOpenMobile] = useState(false)

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

  const filtered =
    floorId === ALL ? items : items.filter((t) => t.effectiveFloorId === floorId)

  const byStatus = (status: TaskStatus) =>
    filtered
      .filter((t) => t.status === status)
      .sort(status === "done" ? compareDoneTasks : compareActiveTasks)

  const doneTasks = byStatus("done")

  const cardHandlers = (task: KanbanTask) => ({
    onMove: (next: TaskStatus) => void moveTask(task.id, next),
    onEdit: () => setDialog({ type: "edit", task }),
    onDelete: () => setDialog({ type: "delete", task }),
  })

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        {/* items maps value→label for SelectValue (Base UI renders the raw value otherwise) */}
        <Select
          value={floorId}
          onValueChange={(v) => updateFloor(v ?? ALL)}
          items={[
            { value: ALL, label: "Wszystkie piętra" },
            ...floors.map((f) => ({ value: f.id, label: f.label })),
          ]}
        >
          <SelectTrigger className="min-h-9 w-auto rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Wszystkie piętra</SelectItem>
            {floors.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button type="button" size="sm" onClick={() => setShowCreate(true)}>
          <PlusIcon className="size-4" />
          Nowe zadanie
        </Button>
      </div>

      {/* Desktop: kanban (lg+) */}
      <div className="hidden lg:grid lg:grid-cols-3 lg:items-start lg:gap-4">
        {(["todo", "doing"] as TaskStatus[]).map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={byStatus(status)}
            pendingIds={pendingIds}
            isDropTarget={dropTarget === status}
            onDragEnterColumn={() => setDropTarget(status)}
            onDragLeaveColumn={() => setDropTarget(null)}
            onDropTask={(taskId) => {
              setDropTarget(null)
              void moveTask(taskId, status)
            }}
            cardHandlers={cardHandlers}
          />
        ))}

        {/* Done column: collapsed header by default; still a drop target */}
        <section
          className={cn(
            "rounded-xl p-3 transition-colors",
            taskStatusConfig.done.columnClass,
            dropTarget === "done" && "bg-brand-soft ring-1 ring-brand"
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setDropTarget("done")
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setDropTarget(null)
            }
          }}
          onDrop={(e) => {
            e.preventDefault()
            setDropTarget(null)
            const taskId = e.dataTransfer.getData("text/plain")
            if (taskId) void moveTask(taskId, "done")
          }}
        >
          <button
            type="button"
            onClick={() => setDoneOpenDesktop((v) => !v)}
            aria-expanded={doneOpenDesktop}
            className="flex w-full items-center gap-2 px-1 py-0.5"
          >
            <span className={cn("size-2 rounded-full", taskStatusConfig.done.dotClass)} />
            <h2 className="text-sm font-semibold">{taskStatusConfig.done.label}</h2>
            <span className="ml-auto text-sm tabular-nums text-muted-foreground">
              {doneTasks.length}
              {doneHasMore && "+"}
            </span>
            <ChevronDownIcon
              className={cn(
                "size-4 text-muted-foreground transition-transform duration-150",
                doneOpenDesktop && "rotate-180"
              )}
            />
          </button>

          {doneOpenDesktop && (
            <div className="mt-3">
              {doneTasks.length === 0 ? (
                <p className="px-1 py-6 text-center text-sm text-muted-foreground/70">
                  Brak zadań
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {doneTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      pending={pendingIds.has(task.id)}
                      draggable
                      {...cardHandlers(task)}
                    />
                  ))}
                </ul>
              )}
              {doneHasMore && (
                <div className="mt-3 flex justify-center">
                  <Button type="button" variant="outline" size="sm" onClick={showMoreDone}>
                    Pokaż więcej
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Mobile: status-grouped card list, same card language */}
      <div className="space-y-5 lg:hidden">
        {(["todo", "doing"] as TaskStatus[]).map((status) => {
          const group = byStatus(status)
          const config = taskStatusConfig[status]
          return (
            <section key={status}>
              <header className="mb-2 flex items-center gap-2 px-1">
                <span className={cn("size-2 rounded-full", config.dotClass)} />
                <h2 className="text-sm font-semibold">{config.label}</h2>
                <span className="ml-auto text-sm tabular-nums text-muted-foreground">
                  {group.length}
                </span>
              </header>
              {group.length === 0 ? (
                <p className="px-1 text-sm text-muted-foreground/70">Brak zadań</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {group.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      pending={pendingIds.has(task.id)}
                      showCheckbox
                      onToggleDone={() =>
                        void moveTask(task.id, task.status === "done" ? "todo" : "done")
                      }
                      {...cardHandlers(task)}
                    />
                  ))}
                </ul>
              )}
            </section>
          )
        })}

        <section>
          <button
            type="button"
            onClick={() => setDoneOpenMobile((v) => !v)}
            aria-expanded={doneOpenMobile}
            className="mb-2 flex w-full items-center gap-2 px-1"
          >
            <span className={cn("size-2 rounded-full", taskStatusConfig.done.dotClass)} />
            <h2 className="text-sm font-semibold">{taskStatusConfig.done.label}</h2>
            <span className="ml-auto text-sm tabular-nums text-muted-foreground">
              {doneTasks.length}
              {doneHasMore && "+"}
            </span>
            <ChevronDownIcon
              className={cn(
                "size-4 text-muted-foreground transition-transform duration-150",
                doneOpenMobile && "rotate-180"
              )}
            />
          </button>

          {doneOpenMobile && (
            <>
              {doneTasks.length === 0 ? (
                <p className="px-1 text-sm text-muted-foreground/70">Brak zadań</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {doneTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      pending={pendingIds.has(task.id)}
                      showCheckbox
                      onToggleDone={() => void moveTask(task.id, "todo")}
                      {...cardHandlers(task)}
                    />
                  ))}
                </ul>
              )}
              {doneHasMore && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={showMoreDone}
                >
                  Pokaż więcej
                </Button>
              )}
            </>
          )}
        </section>
      </div>

      {showCreate && (
        <TaskForm
          mode="create"
          projectId={projectId}
          floors={floors}
          apartments={apartments}
          onClose={() => setShowCreate(false)}
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

function KanbanColumn({
  status,
  tasks,
  pendingIds,
  isDropTarget,
  onDragEnterColumn,
  onDragLeaveColumn,
  onDropTask,
  cardHandlers,
}: {
  status: TaskStatus
  tasks: KanbanTask[]
  pendingIds: Set<string>
  isDropTarget: boolean
  onDragEnterColumn: () => void
  onDragLeaveColumn: () => void
  onDropTask: (taskId: string) => void
  cardHandlers: (task: KanbanTask) => {
    onMove: (next: TaskStatus) => void
    onEdit: () => void
    onDelete: () => void
  }
}) {
  const config = taskStatusConfig[status]
  return (
    <section
      className={cn(
        "rounded-xl p-3 transition-colors",
        config.columnClass,
        isDropTarget && "bg-brand-soft ring-1 ring-brand"
      )}
      onDragOver={(e) => {
        e.preventDefault()
        onDragEnterColumn()
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          onDragLeaveColumn()
        }
      }}
      onDrop={(e) => {
        e.preventDefault()
        const taskId = e.dataTransfer.getData("text/plain")
        if (taskId) onDropTask(taskId)
      }}
    >
      <header className="mb-3 flex items-center gap-2 px-1">
        <span className={cn("size-2 rounded-full", config.dotClass)} />
        <h2 className="text-sm font-semibold">{config.label}</h2>
        <span className="ml-auto text-sm tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
      </header>

      {tasks.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-muted-foreground/70">
          Brak zadań
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              pending={pendingIds.has(task.id)}
              draggable
              {...cardHandlers(task)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

/** Shared card language: scope chip, overdue border, creator initials, move/edit/delete menu.
 *  Mobile adds a quick-complete checkbox; desktop adds drag. */
function TaskCard({
  task,
  pending,
  draggable = false,
  showCheckbox = false,
  onToggleDone,
  onMove,
  onEdit,
  onDelete,
}: {
  task: KanbanTask
  pending: boolean
  draggable?: boolean
  showCheckbox?: boolean
  onToggleDone?: () => void
  onMove: (next: TaskStatus) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const overdue = isOverdue(task)
  return (
    <li
      draggable={draggable && !pending}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id)
        e.dataTransfer.effectAllowed = "move"
      }}
      className={cn(
        "rounded-lg border bg-card p-3",
        overdue ? "border-status-open-bd" : "border-border-soft",
        pending && "opacity-60",
        draggable && !pending && "cursor-grab active:cursor-grabbing"
      )}
    >
      <div className="flex items-start gap-2">
        {showCheckbox && (
          <input
            type="checkbox"
            checked={task.status === "done"}
            onChange={onToggleDone}
            disabled={pending}
            aria-label={`Oznacz jako ${task.status === "done" ? "do zrobienia" : "zrobione"}: ${task.title}`}
            className="mt-0.5 size-4 cursor-pointer accent-primary"
          />
        )}
        <p
          className={cn(
            "min-w-0 flex-1 text-sm font-medium",
            task.status === "done" && "text-muted-foreground line-through"
          )}
        >
          {task.title}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Akcje zadania: ${task.title}`}
            disabled={pending}
          >
            <EllipsisVerticalIcon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Przenieś do</DropdownMenuLabel>
              {TASK_STATUSES.filter((s) => s !== task.status).map((s) => (
                <DropdownMenuItem key={s} onClick={() => onMove(s)}>
                  {taskStatusConfig[s].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onEdit}>
              <PencilIcon className="size-4" />
              Edytuj
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete}>
              <Trash2Icon className="size-4" />
              Usuń
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {task.scopeLabel}
        </span>
        {task.due_date && (
          <span
            className={cn(
              "text-xs",
              overdue ? "font-medium text-status-open" : "text-muted-foreground"
            )}
          >
            {formatDue(task.due_date)}
          </span>
        )}
        {task.initials && (
          <span
            title={task.creatorEmail ?? undefined}
            className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[10px] font-semibold text-brand"
          >
            {task.initials}
          </span>
        )}
      </div>
    </li>
  )
}
