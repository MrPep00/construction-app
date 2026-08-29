/** Single-market product: Europe/Warsaw is the one correct display
 *  timezone, so pin it instead of letting each runtime pick its own.
 *  Vercel renders in UTC and the browser in Europe/Warsaw, so an
 *  unpinned toLocaleString() disagrees between SSR and hydration by the
 *  UTC offset — near midnight it disagrees about the DATE. A pinned
 *  formatter is byte-identical on both sides. */
export const PROJECT_TIME_ZONE = "Europe/Warsaw"

/** Intl.DateTimeFormat construction is expensive and these run per row
 *  in file/issue/movement lists — cache one instance per option set. */
const formatterCache = new Map<string, Intl.DateTimeFormat>()

function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options)
  let cached = formatterCache.get(key)
  if (!cached) {
    cached = new Intl.DateTimeFormat("pl-PL", options)
    formatterCache.set(key, cached)
  }
  return cached
}

const ABSOLUTE_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: PROJECT_TIME_ZONE,
}

/** Deterministic absolute timestamp — safe to render during SSR. */
export function formatAbsolutePl(date: Date): string {
  if (Number.isNaN(date.getTime())) return "—"
  return formatter(ABSOLUTE_OPTIONS).format(date)
}

/** For `timestamptz` columns — an instant, displayed in project time. */
export function formatTimestampPl(
  date: Date,
  options: Intl.DateTimeFormatOptions
): string {
  if (Number.isNaN(date.getTime())) return "—"
  return formatter({ ...options, timeZone: PROJECT_TIME_ZONE }).format(date)
}

/** For `date` columns (tasks.due_date) — a calendar date with no
 *  timezone at all. Parsing "2026-08-29T00:00:00" uses the runtime's
 *  zone, which on a UTC+9 host lands on the previous day once formatted
 *  anywhere west of it; anchoring both ends to UTC renders the stored
 *  date verbatim on every runtime. */
export function formatCalendarDatePl(
  isoDate: string,
  options: Intl.DateTimeFormatOptions
): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return "—"
  return formatter({ ...options, timeZone: "UTC" }).format(date)
}
