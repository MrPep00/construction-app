/** Display ordering for floors + zones (migration 023).
 *  sort_order asc = canonical list order: Dach first, ..., Piwnica -2, zones last. */

export type SortableFloor = { sort_order: number; kind: string }

/** topFirst: canonical order (Dach → Piwnica, zones last) — same as
 *  `.order("sort_order")` in SQL; use this helper when sorting in JS.
 *  bottomFirst: floors reversed (Piwnica → Dach) but zones STAY last —
 *  a plain sort_order desc would wrongly put zones first. */
export function sortFloorsForDisplay<T extends SortableFloor>(
  floors: T[],
  direction: "topFirst" | "bottomFirst"
): T[] {
  const regular = floors
    .filter((f) => f.kind !== "zone")
    .sort((a, b) => a.sort_order - b.sort_order)
  if (direction === "bottomFirst") regular.reverse()
  const zones = floors
    .filter((f) => f.kind === "zone")
    .sort((a, b) => a.sort_order - b.sort_order)
  return [...regular, ...zones]
}
