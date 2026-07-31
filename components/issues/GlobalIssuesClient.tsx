"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ImageIcon } from "lucide-react"
import { formatDistanceToNowStrict } from "date-fns"
import { pl } from "date-fns/locale"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { IssueStatus } from "@/lib/types/db"
import { resolveIssue, reopenIssue } from "@/lib/actions/issues"
import { Button } from "@/components/ui/button"
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

type Filters = {
  status: StatusFilter
  floorId: string
  apartmentId: string
  contractor: string
}

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "open", label: "Otwarte" },
  { value: "resolved", label: "Usunięte" },
  { value: "all", label: "Wszystkie" },
]

const ALL = "all"
/** URL/select sentinel for contractor IS NULL */
const NO_CONTRACTOR = "__none__"

function filtersToParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.status !== "open") params.set("status", filters.status)
  if (filters.floorId !== ALL) params.set("floor", filters.floorId)
  if (filters.apartmentId !== ALL) params.set("apartment", filters.apartmentId)
  if (filters.contractor !== ALL) params.set("contractor", filters.contractor)
  return params
}

export function GlobalIssuesClient({
  rows,
  floors,
  apartments,
  hasMore,
  limit,
}: {
  rows: GlobalIssueRow[]
  floors: { id: string; level: number; label: string }[]
  apartments: { id: string; name: string; floorId: string }[]
  hasMore: boolean
  limit: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [filters, setFilters] = useState<Filters>(() => {
    const status = searchParams.get("status")
    return {
      status: status === "resolved" || status === "all" ? status : "open",
      floorId: searchParams.get("floor") ?? ALL,
      apartmentId: searchParams.get("apartment") ?? ALL,
      contractor: searchParams.get("contractor") ?? ALL,
    }
  })

  function updateFilters(patch: Partial<Filters>) {
    const next = { ...filters, ...patch }
    setFilters(next)
    // Filter change resets pagination (limit param intentionally dropped)
    const params = filtersToParams(next)
    router.replace(params.size > 0 ? `${pathname}?${params}` : pathname, {
      scroll: false,
    })
  }

  function showMore() {
    const params = filtersToParams(filters)
    params.set("limit", String(limit + 200))
    router.replace(`${pathname}?${params}`, { scroll: false })
  }

  // Local copy for optimistic status toggles; resyncs when server data refreshes
  const [items, setItems] = useState(rows)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  useEffect(() => setItems(rows), [rows])

  async function toggleStatus(row: GlobalIssueRow) {
    const next: IssueStatus = row.status === "open" ? "resolved" : "open"
    const previous = row.status
    setItems((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, status: next } : r))
    )
    setPendingIds((prev) => new Set(prev).add(row.id))

    const result =
      next === "resolved" ? await resolveIssue(row.id) : await reopenIssue(row.id)

    setPendingIds((prev) => {
      const copy = new Set(prev)
      copy.delete(row.id)
      return copy
    })

    if (result.error) {
      setItems((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, status: previous } : r))
      )
      toast.error(result.error)
    } else {
      // Re-render server components so the sidebar open-count badge stays consistent
      router.refresh()
    }
  }

  const apartmentOptions = useMemo(
    () =>
      filters.floorId === ALL
        ? apartments
        : apartments.filter((a) => a.floorId === filters.floorId),
    [apartments, filters.floorId]
  )

  // Distinct contractors from the loaded page of rows
  const contractorOptions = useMemo(
    () =>
      [...new Set(rows.map((r) => r.contractor).filter((c): c is string => !!c))].sort(
        (a, b) => a.localeCompare(b, "pl")
      ),
    [rows]
  )

  const filtered = items.filter((r) => {
    if (filters.status !== "all" && r.status !== filters.status) return false
    if (filters.floorId !== ALL && r.floorId !== filters.floorId) return false
    if (filters.apartmentId !== ALL && r.apartmentId !== filters.apartmentId)
      return false
    if (filters.contractor !== ALL) {
      if (filters.contractor === NO_CONTRACTOR) {
        if (r.contractor !== null) return false
      } else if (r.contractor !== filters.contractor) {
        return false
      }
    }
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
              onClick={() => updateFilters({ status: chip.value })}
              className={cn(
                "min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors",
                filters.status === chip.value
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <Select
          value={filters.floorId}
          onValueChange={(v) =>
            updateFilters({ floorId: v ?? ALL, apartmentId: ALL })
          }
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

        <Select
          value={filters.apartmentId}
          onValueChange={(v) => updateFilters({ apartmentId: v ?? ALL })}
        >
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

        <Select
          value={filters.contractor}
          onValueChange={(v) => updateFilters({ contractor: v ?? ALL })}
        >
          <SelectTrigger className="min-h-9 w-auto shrink-0 rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Wszyscy</SelectItem>
            <SelectItem value={NO_CONTRACTOR}>Nieprzypisany</SelectItem>
            {contractorOptions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
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
            <li
              key={row.id}
              className="flex items-stretch gap-3 rounded-xl border border-border bg-card p-3"
            >
              <Link
                href={row.href}
                className="-m-3 flex min-w-0 flex-1 items-center gap-3 rounded-l-xl p-3 transition-colors hover:bg-muted"
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
              </Link>
              <div className="flex shrink-0 flex-col items-end justify-between gap-2">
                <StatusBadge status={row.status} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pendingIds.has(row.id)}
                  onClick={() => toggleStatus(row)}
                >
                  {row.status === "open" ? "Potwierdź usunięcie" : "Otwórz ponownie"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button type="button" variant="outline" onClick={showMore}>
            Pokaż więcej
          </Button>
        </div>
      )}
    </div>
  )
}
