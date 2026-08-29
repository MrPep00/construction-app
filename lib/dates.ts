/** Single-site Polish app: pin the display timezone instead of letting
 *  each runtime pick its own. Vercel renders in UTC and the browser in
 *  Europe/Warsaw, so an unpinned toLocaleString() disagrees between SSR
 *  and hydration by the UTC offset — near midnight it disagrees about
 *  the DATE. A pinned formatter is byte-identical on both sides. */
export const PROJECT_TIME_ZONE = "Europe/Warsaw"

const absoluteFormatter = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: PROJECT_TIME_ZONE,
})

/** Deterministic absolute timestamp — safe to render during SSR. */
export function formatAbsolutePl(date: Date): string {
  if (Number.isNaN(date.getTime())) return "—"
  return absoluteFormatter.format(date)
}
