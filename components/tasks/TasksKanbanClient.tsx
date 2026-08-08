"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { EllipsisVerticalIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { TaskStatus } from "@/lib/types/db"
import { TASK_STATUSES, taskStatusConfig } from "@/lib/status"
import { updateTaskStatus } from "@/lib/actions/tasks"
import { TaskListClient, type TaskRow } from "./TaskListClient"
import { TaskForm, type FloorOption, type ApartmentOption } from "./TaskForm"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
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
  initials: string | null
  creatorEmail: string | null
}

const ALL = "all"

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
}: {
  projectId: string
  tasks: KanbanTask[]
  floors: FloorOption[]
  apartments: ApartmentOption[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [floorId, setFloorId] = useState<string>(
    () => searchParams.get("floor") ?? ALL
  )

  function updateFloor(value: string) {
    setFloorId(value)
    const params = new URLSearchParams()
    if (value !== ALL) params.set("floor", value)
    router.replace(params.size > 0 ? `${pathname}?${params}` : pathname, {
      scroll: false,
    })
  }

  // Local copy for optimistic moves; in-flight tasks keep their optimistic
  // status when server data refreshes (same pattern as GlobalIssuesClient)
  const [items, setItems] = useState(tasks)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const pendingIdsRef = useRef(pendingIds)
  pendingIdsRef.current = pendingIds
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

  const filtered =
    floorId === ALL ? items : items.filter((t) => t.effectiveFloorId === floorId)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Select value={floorId} onValueChange={(v) => updateFloor(v ?? ALL)}>
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

        {/* Mobile list has its own create button (TaskListClient) */}
        <Button
          type="button"
          size="sm"
          className="hidden lg:inline-flex"
          onClick={() => setShowCreate(true)}
        >
          <PlusIcon className="size-4" />
          Nowe zadanie
        </Button>
      </div>

      {/* Desktop: kanban (lg+) */}
      <div className="hidden lg:grid lg:grid-cols-3 lg:items-start lg:gap-4">
        {TASK_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={filtered.filter((t) => t.status === status)}
            pendingIds={pendingIds}
            isDropTarget={dropTarget === status}
            onDragEnterColumn={() => setDropTarget(status)}
            onDragLeaveColumn={() => setDropTarget(null)}
            onDropTask={(taskId) => {
              setDropTarget(null)
              void moveTask(taskId, status)
            }}
            onMoveTask={moveTask}
          />
        ))}
      </div>

      {/* Mobile: existing list UI */}
      <div className="lg:hidden">
        <TaskListClient
          tasks={filtered}
          projectId={projectId}
          floors={floors}
          apartments={apartments}
        />
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
  onMoveTask,
}: {
  status: TaskStatus
  tasks: KanbanTask[]
  pendingIds: Set<string>
  isDropTarget: boolean
  onDragEnterColumn: () => void
  onDragLeaveColumn: () => void
  onDropTask: (taskId: string) => void
  onMoveTask: (taskId: string, next: TaskStatus) => void
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
            <KanbanCard
              key={task.id}
              task={task}
              pending={pendingIds.has(task.id)}
              onMove={(next) => onMoveTask(task.id, next)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function KanbanCard({
  task,
  pending,
  onMove,
}: {
  task: KanbanTask
  pending: boolean
  onMove: (next: TaskStatus) => void
}) {
  const overdue = isOverdue(task)
  return (
    <li
      draggable={!pending}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id)
        e.dataTransfer.effectAllowed = "move"
      }}
      className={cn(
        "rounded-lg border bg-card p-3",
        overdue ? "border-status-open-bd" : "border-border-soft",
        pending ? "opacity-60" : "cursor-grab active:cursor-grabbing"
      )}
    >
      <div className="flex items-start gap-1">
        <p className="min-w-0 flex-1 text-sm font-medium">{task.title}</p>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Przenieś zadanie: ${task.title}`}
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
