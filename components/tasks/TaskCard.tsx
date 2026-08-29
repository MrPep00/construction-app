"use client"

import {
  EllipsisVerticalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { TaskStatus } from "@/lib/types/db"
import { TASK_STATUSES, taskStatusConfig } from "@/lib/status"
import type { TaskRow } from "./TaskListClient"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatCalendarDatePl } from "@/lib/dates"

export type KanbanTask = TaskRow & {
  scopeType: "global" | "floor" | "location"
  /** e.g. "Ogólne", "P3", "M31 · P3" */
  scopeLabel: string
  /** Floor the task belongs to (via location for location-scoped); null = global */
  effectiveFloorId: string | null
  /** Canonical floor position for ordering (see lib/tasks/scope.ts); null = global */
  effectiveFloorSort: number | null
  /** Apartment/location name for pl-numeric collation; null = global/floor scope */
  locationSortName: string | null
  initials: string | null
  creatorEmail: string | null
}

export function isTaskOverdue(task: KanbanTask) {
  if (!task.due_date || task.status === "done") return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(task.due_date + "T00:00:00") < today
}

export function formatTaskDue(dateStr: string) {
  return formatCalendarDatePl(dateStr, {
    day: "numeric",
    month: "short",
  })
}

/** Shared card language: scope chip, overdue border, creator initials, move/edit/delete menu.
 *  Mobile/list contexts add a quick-complete checkbox; desktop kanban adds drag. */
export function TaskCard({
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
  const overdue = isTaskOverdue(task)
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
            {formatTaskDue(task.due_date)}
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
