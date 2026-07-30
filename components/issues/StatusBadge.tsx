import { cn } from "@/lib/utils"
import type { IssueStatus } from "@/lib/types/db"
import { getIssueStatusConfig } from "@/lib/status"

interface Props {
  status: IssueStatus
  className?: string
}

export function StatusBadge({ status, className }: Props) {
  const { label, badgeClass } = getIssueStatusConfig(status)
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        badgeClass,
        className
      )}
    >
      {label}
    </span>
  )
}
