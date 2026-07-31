import Link from "next/link"
import { cn } from "@/lib/utils"
import { getIssueStatusConfig } from "@/lib/status"
import { buttonVariants } from "@/components/ui/button"

export type MatrixApartment = {
  id: string
  name: string
  openCount: number
}

export type MatrixRow = {
  floorId: string
  level: number
  label: string
  /** Open issues on this floor's locations without an apartment ancestor */
  unassignedCount: number
  apartments: MatrixApartment[]
}

export function BuildingMatrix({
  projectId,
  rows,
}: {
  projectId: string
  rows: MatrixRow[]
}) {
  if (rows.every((r) => r.apartments.length === 0)) {
    const targetLevel =
      rows.find((r) => r.level === 0)?.level ?? rows[0]?.level ?? 0
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
        <div>
          <p className="font-medium">Brak mieszkań w projekcie</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Dodaj mieszkania na piętrach, aby zobaczyć matrycę budynku.
          </p>
        </div>
        <Link
          href={`/projects/${projectId}/floors/${targetLevel}`}
          className={buttonVariants({ size: "sm" })}
        >
          Dodaj strukturę
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <div key={row.floorId} className="flex items-start gap-3">
          <Link
            href={`/projects/${projectId}/floors/${row.level}`}
            className="flex h-11 w-20 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={row.label}
          >
            <span className="truncate">{row.label}</span>
            {row.unassignedCount > 0 && (
              <span
                title="usterki poza mieszkaniami"
                className="shrink-0 rounded-full bg-status-open-bg px-1.5 py-0.5 text-xs font-semibold tabular-nums text-status-open"
              >
                +{row.unassignedCount}
              </span>
            )}
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
