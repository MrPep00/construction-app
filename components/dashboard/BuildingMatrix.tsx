import Link from "next/link"
import { cn } from "@/lib/utils"
import { getIssueStatusConfig } from "@/lib/status"

export type MatrixApartment = {
  id: string
  name: string
  openCount: number
}

export type MatrixRow = {
  floorId: string
  level: number
  label: string
  apartments: MatrixApartment[]
}

export function BuildingMatrix({
  projectId,
  rows,
}: {
  projectId: string
  rows: MatrixRow[]
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <div key={row.floorId} className="flex items-start gap-3">
          <Link
            href={`/projects/${projectId}/floors/${row.level}`}
            className="flex h-11 w-20 shrink-0 items-center rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={row.label}
          >
            <span className="truncate">{row.label}</span>
          </Link>

          {row.apartments.length === 0 ? (
            <div className="flex h-11 flex-1 items-center rounded-lg border border-dashed border-border-soft px-3 text-sm text-muted-foreground/70">
              Brak mieszkań
            </div>
          ) : (
            <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1.5">
              {row.apartments.map((apt) => {
                const status = apt.openCount > 0 ? "open" : "resolved"
                const { cellClass } = getIssueStatusConfig(status)
                return (
                  <Link
                    key={apt.id}
                    href={`/projects/${projectId}/floors/${row.level}/${apt.id}`}
                    title={apt.name}
                    className={cn(
                      "flex min-h-11 items-center justify-between gap-1 rounded-lg border px-2.5 py-1.5 transition-opacity hover:opacity-80",
                      cellClass
                    )}
                  >
                    <span className="truncate text-sm font-medium">
                      {apt.name}
                    </span>
                    {apt.openCount > 0 && (
                      <span className="text-sm font-semibold tabular-nums">
                        {apt.openCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
