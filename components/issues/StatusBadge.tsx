import { cn } from "@/lib/utils"
import type { IssueStatus } from "@/lib/types/db"

const STATUS_CONFIG: Record<IssueStatus, { label: string; className: string }> = {
  open: {
    label: "Otwarta",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  in_progress: {
    label: "W trakcie",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  resolved: {
    label: "Rozwiązana",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  rejected: {
    label: "Odrzucona",
    className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  },
}

interface Props {
  status: IssueStatus
  className?: string
}

export function StatusBadge({ status, className }: Props) {
  const { label, className: colorClass } = STATUS_CONFIG[status]
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colorClass,
        className
      )}
    >
      {label}
    </span>
  )
}
