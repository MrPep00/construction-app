"use client"

import { useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import type { TaskStatus } from "@/lib/types/db"
import { TASK_STATUSES, taskStatusConfig } from "@/lib/status"
import { TaskListClient, type TaskRow } from "./TaskListClient"
import type { FloorOption, ApartmentOption } from "./TaskForm"
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

  const filtered =
    floorId === ALL ? tasks : tasks.filter((t) => t.effectiveFloorId === floorId)

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
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
      </div>

      {/* Desktop: kanban (lg+) */}
      <div className="hidden lg:grid lg:grid-cols-3 lg:items-start lg:gap-4">
        {TASK_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={filtered.filter((t) => t.status === status)}
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
    </div>
  )
}

function KanbanColumn({
  status,
  tasks,
}: {
  status: TaskStatus
  tasks: KanbanTask[]
}) {
  const config = taskStatusConfig[status]
  return (
    <section className={cn("rounded-xl p-3", config.columnClass)}>
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
            <KanbanCard key={task.id} task={task} />
          ))}
        </ul>
      )}
    </section>
  )
}

function KanbanCard({ task }: { task: KanbanTask }) {
  const overdue = isOverdue(task)
  return (
    <li
      className={cn(
        "rounded-lg border bg-card p-3",
        overdue ? "border-status-open-bd" : "border-border-soft"
      )}
    >
      <p className="text-sm font-medium">{task.title}</p>
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
