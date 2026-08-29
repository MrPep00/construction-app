"use client"

import { useSyncExternalStore } from "react"
import { formatDistanceToNowStrict } from "date-fns"
import { pl } from "date-fns/locale"
import { formatAbsolutePl } from "@/lib/dates"

/** "Have we hydrated yet?" as an external store rather than a
 *  useEffect(() => setMounted(true)) flag — that flag is exactly what
 *  react-hooks/set-state-in-effect rejects, and this repo treats that
 *  rule as an error. getServerSnapshot returns false, so SSR and the
 *  hydration pass both render the absolute form and match byte for
 *  byte; React then re-renders with true and swaps in the relative
 *  form, after hydration is done. */
const subscribeToNothing = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

interface Props {
  date: string | Date
  /** "12 minut temu" instead of "12 minut". */
  addSuffix?: boolean
  className?: string
}

/** Renders a timestamp relatively ("3 dni", "12 minut temu") without
 *  causing React #418. Relative time depends on Date.now(), which moves
 *  between the server render and hydration — so the first paint is the
 *  absolute timestamp and the relative form arrives after mount. */
export function RelativeTime({ date, addSuffix = false, className }: Props) {
  const value = typeof date === "string" ? new Date(date) : date
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    getSnapshot,
    getServerSnapshot
  )

  if (Number.isNaN(value.getTime())) {
    return <span className={className}>—</span>
  }

  const absolute = formatAbsolutePl(value)

  return (
    <time dateTime={value.toISOString()} title={absolute} className={className}>
      {hydrated
        ? formatDistanceToNowStrict(value, { locale: pl, addSuffix })
        : absolute}
    </time>
  )
}
