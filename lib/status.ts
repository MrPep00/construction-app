import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
  type LucideIcon,
} from "lucide-react"
import type { IssueStatus, TaskStatus } from "@/lib/types/db"

export type IssueStatusConfig = {
  /** Polish UI label, feminine form (usterka) */
  label: string
  /** Section/group label, plural */
  sectionLabel: string
  /** Rounded pill badge */
  badgeClass: string
  /** Small round indicator dot */
  dotClass: string
  /** P3 building-matrix cell surface (bg + border + text) */
  cellClass: string
  icon: LucideIcon
}

export const ISSUE_STATUSES: IssueStatus[] = ["open", "resolved"]

export const issueStatusConfig: Record<IssueStatus, IssueStatusConfig> = {
  open: {
    label: "Otwarta",
    sectionLabel: "Otwarte",
    badgeClass: "border border-status-open-bd bg-status-open-bg text-status-open",
    dotClass: "bg-status-open",
    cellClass: "border-status-open-bd bg-status-open-bg text-status-open",
    icon: CircleAlertIcon,
  },
  resolved: {
    label: "Usunięta",
    sectionLabel: "Usunięte",
    badgeClass: "border border-status-resolved-bd bg-status-resolved-bg text-status-resolved",
    dotClass: "bg-status-resolved",
    cellClass: "border-status-resolved-bd bg-status-resolved-bg text-status-resolved",
    icon: CircleCheckIcon,
  },
}

export type TaskStatusConfig = {
  /** Polish UI label / kanban column header */
  label: string
  /** Small round indicator dot (column header) */
  dotClass: string
  /** Kanban column surface */
  columnClass: string
  icon: LucideIcon
}

export const TASK_STATUSES: TaskStatus[] = ["todo", "doing", "done"]

export const taskStatusConfig: Record<TaskStatus, TaskStatusConfig> = {
  todo: {
    label: "Do zrobienia",
    dotClass: "bg-muted-foreground/50",
    columnClass: "bg-muted",
    icon: CircleDashedIcon,
  },
  doing: {
    label: "W trakcie",
    dotClass: "bg-brand",
    columnClass: "bg-muted",
    icon: CircleDotIcon,
  },
  done: {
    label: "Zrobione",
    dotClass: "bg-status-resolved",
    columnClass: "bg-muted",
    icon: CircleCheckIcon,
  },
}

/** Tolerant lookup: warns and falls back to "open" on an unknown status
 *  (e.g. stale client data mid-migration) instead of crashing the UI. */
export function getIssueStatusConfig(status: string): IssueStatusConfig {
  const config = issueStatusConfig[status as IssueStatus]
  if (!config) {
    console.warn(`lib/status: unknown issue status "${status}", falling back to "open"`)
    return issueStatusConfig.open
  }
  return config
}
