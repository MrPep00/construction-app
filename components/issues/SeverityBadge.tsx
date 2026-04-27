import { cn } from "@/lib/utils"
import type { IssueSeverity } from "@/lib/types/db"

const SEVERITY_CONFIG: Record<IssueSeverity, { label: string; className: string }> = {
  low: {
    label: "Niska",
    className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  },
  normal: {
    label: "Normalna",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  high: {
    label: "Wysoka",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  critical: {
    label: "Krytyczna",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
}

interface Props {
  severity: IssueSeverity
  className?: string
}

export function SeverityBadge({ severity, className }: Props) {
  const { label, className: colorClass } = SEVERITY_CONFIG[severity]
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
