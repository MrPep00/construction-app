import { cn } from "@/lib/utils"
import type { IssueStatus } from "@/lib/types/db"

// TODO(P2): route colors through lib/status.ts semantic tokens once it exists
const STATUS_CONFIG: Record<IssueStatus, { label: string; className: string }> = {
  open: {
    label: "Otwarta",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  resolved: {
    label: "Rozwiązana",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
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
