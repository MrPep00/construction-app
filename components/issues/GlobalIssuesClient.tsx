"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ImageIcon } from "lucide-react"
import { formatDistanceToNowStrict } from "date-fns"
import { pl } from "date-fns/locale"
import { cn } from "@/lib/utils"
import type { IssueStatus } from "@/lib/types/db"
import { StatusBadge } from "./StatusBadge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type GlobalIssueRow = {
  id: string
  title: string
  status: IssueStatus
  createdAt: string
  contractor: string | null
  floorId: string
  apartmentId: string | null
  /** e.g. "M31 · P3" or "Zmiany lokatorskie · P3" */
  locationLabel: string
  href: string
  thumbUrl: string | null
}

type StatusFilter = "open" | "resolved" | "all"

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "open", label: "Otwarte" },
  { value: "resolved", label: "Usunięte" },
  { value: "all", label: "Wszystkie" },
]

const ALL = "all"

export function GlobalIssuesClient({
  rows,
  floors,
  apartments,
}: {
  rows: GlobalIssueRow[]
  floors: { id: string; level: number; label: string }[]
  apartments: { id: string; name: string; floorId: string }[]
}) {
  const [status, setStatus] = useState<StatusFilter>("open")
  const [floorId, setFloorId] = useState<string>(ALL)
  const [apartmentId, setApartmentId] = useState<string>(ALL)

  const apartmentOptions = useMemo(
    () =>
      floorId === ALL
        ? apartments
        : apartments.filter((a) => a.floorId === floorId),
    [apartments, floorId]
  )

  const filtered = rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false
    if (floorId !== ALL && r.floorId !== floorId) return false
    if (apartmentId !== ALL && r.apartmentId !== apartmentId) return false
    return true
  })

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
        <div className="flex shrink-0 gap-1.5" role="group" aria-label="Filtr statusu">
          {STATUS_CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setStatus(chip.value)}
              className={cn(
                "min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors",
                status === chip.value
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <Select
          value={floorId}
          onValueChange={(v) => {
            setFloorId(v ?? ALL)
            setApartmentId(ALL)
          }}
        >
          <SelectTrigger className="min-h-9 w-auto shrink-0 rounded-full">
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

        <Select value={apartmentId} onValueChange={(v) => setApartmentId(v ?? ALL)}>
          <SelectTrigger className="min-h-9 w-auto shrink-0 rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Wszystkie mieszkania</SelectItem>
            {apartmentOptions.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          Brak usterek dla wybranych filtrów.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((row) => (
            <li key={row.id}>
              <Link
                href={row.href}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted"
              >
                {row.thumbUrl ? (
                  <span className="relative size-16 shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={row.thumbUrl}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </span>
                ) : (
                  <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground/60">
                    <ImageIcon className="size-6" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{row.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {row.locationLabel} ·{" "}
                    {formatDistanceToNowStrict(new Date(row.createdAt), {
                      locale: pl,
                    })}
                  </p>
                  {row.contractor && (
                    <p className="truncate text-sm text-muted-foreground/80">
                      {row.contractor}
                    </p>
                  )}
                </div>
                <StatusBadge status={row.status} className="shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
