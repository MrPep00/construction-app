import Link from "next/link"
import { requireAdmin } from "@/lib/auth/admin-check"
import {
  fetchAdminErrors,
  fetchAdminErrorStats,
} from "@/lib/supabase/admin-context"
import { ErrorCard } from "@/components/admin/ErrorCard"

const SEVERITY_LABELS: Record<string, string> = {
  warn: "Ostrzeżenie",
  error: "Błąd",
  fatal: "Krytyczny",
}

export default async function AdminErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{
    show?: string
    severity?: string
    user?: string
  }>
}) {
  await requireAdmin()

  const { show, severity, user: userFilter } = await searchParams

  const showAll = show === "all"
  const activeSeverity = severity ?? null
  const activeUser = userFilter ?? null

  const [statsResult, errorsResult] = await Promise.all([
    fetchAdminErrorStats(),
    fetchAdminErrors({
      showResolved: showAll,
      severity: activeSeverity,
      userEmail: activeUser,
    }),
  ])

  const stats = statsResult.data
  const errors = errorsResult.data

  const hasFilters = showAll || activeSeverity || activeUser

  function filterLink(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams()
    const merged = { show, severity, user: userFilter, ...params }
    for (const [k, v] of Object.entries(merged)) {
      if (v) sp.set(k, v)
    }
    const qs = sp.toString()
    return `/admin/errors${qs ? `?${qs}` : ""}`
  }

  return (
    <main className="container mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Logi błędów</h1>
        <Link
          href="/projects"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Projekty
        </Link>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Nierozwiązane" value={stats.total_unresolved} />
          <StatCard label="Dzisiaj" value={stats.today} />
          <StatCard label="Ten tydzień" value={stats.this_week} />
          <StatCard
            label="Ostrzeżeń"
            value={stats.count_warn}
            colorClass="text-yellow-700 dark:text-yellow-400"
          />
          <StatCard
            label="Błędów"
            value={stats.count_error}
            colorClass="text-red-700 dark:text-red-400"
          />
          <StatCard
            label="Krytycznych"
            value={stats.count_fatal}
            colorClass="text-purple-700 dark:text-purple-400"
          />
        </div>
      )}

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={filterLink({ show: showAll ? undefined : "all" })}
          className={`rounded-full px-3 py-1 transition-colors ${showAll ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
        >
          {showAll ? "Pokaż wszystkie" : "Tylko nierozwiązane"}
        </Link>

        {(["warn", "error", "fatal"] as const).map((s) => (
          <Link
            key={s}
            href={filterLink({ severity: activeSeverity === s ? undefined : s })}
            className={`rounded-full px-3 py-1 transition-colors ${
              activeSeverity === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            {SEVERITY_LABELS[s]}
          </Link>
        ))}

        {hasFilters && (
          <Link
            href="/admin/errors"
            className="rounded-full px-3 py-1 text-muted-foreground hover:text-foreground"
          >
            Wyczyść filtry ✕
          </Link>
        )}
      </div>

      {/* Error list */}
      {errors.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          {hasFilters
            ? "Brak błędów spełniających filtry."
            : "Brak nierozwiązanych błędów. Dobra robota."}
        </p>
      ) : (
        <div className="space-y-3">
          {errors.map((log) => (
            <ErrorCard key={log.id} log={log} />
          ))}
        </div>
      )}
    </main>
  )
}

function StatCard({
  label,
  value,
  colorClass,
}: {
  label: string
  value: number
  colorClass?: string
}) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <p className={`text-2xl font-bold tabular-nums ${colorClass ?? ""}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
