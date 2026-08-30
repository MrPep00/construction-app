import Link from "next/link"
import { cn } from "@/lib/utils"
import { getIssueStatusConfig } from "@/lib/status"
import { buttonVariants } from "@/components/ui/button"

export type MatrixApartment = {
  id: string
  name: string
  /** Short badge from locations.matrix_label; falls back to the full name */
  matrixLabel: string | null
  openCount: number
}

/** Matrix cell surface (colors come from getIssueStatusConfig().cellClass).
 *  Shared with the "Dodaj lokal" form preview so both render identically. */
export const MATRIX_CELL_CLASS =
  "flex min-h-11 items-center justify-between gap-1 rounded-lg border px-2.5 py-1.5"
export const MATRIX_CELL_LABEL_CLASS = "truncate text-sm font-medium"

/** Comfort threshold for a cell label's rendered width (px). The grid track
 *  is 5.5rem/88px minus 2×10px padding and the count badge, so a label wider
 *  than this starts crowding the cell. Soft warning only — never a block. */
export const MATRIX_LABEL_COMFORT_PX = 64

export type MatrixRow = {
  floorId: string
  level: number
  label: string
  /** 'floor' | 'zone' — zones render label + pill only, no apartment cells */
  kind: string
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
          <p className="font-medium">Brak lokali w projekcie</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Dodaj lokale na piętrach, aby zobaczyć matrycę budynku.
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
            className={cn(
              "flex h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              row.kind === "zone" ? "max-w-full" : "w-20"
            )}
            title={row.label}
          >
            <span className="truncate">{row.label}</span>
            {row.unassignedCount > 0 && (
              <span
                title={
                  row.kind === "zone"
                    ? "usterki w strefie"
                    : "usterki poza lokalami"
                }
                className="shrink-0 rounded-full bg-status-open-bg px-1.5 py-0.5 text-xs font-semibold tabular-nums text-status-open"
              >
                +{row.unassignedCount}
              </span>
            )}
          </Link>

          {row.kind === "zone" ? null : row.apartments.length === 0 ? (
            <div className="flex h-11 flex-1 items-center rounded-lg border border-dashed border-border-soft px-3 text-sm text-muted-foreground/70">
              Brak lokali
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
                      MATRIX_CELL_CLASS,
                      "transition-opacity hover:opacity-80",
                      cellClass
                    )}
                  >
                    <span className={MATRIX_CELL_LABEL_CLASS}>
                      {apt.matrixLabel ?? apt.name}
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
