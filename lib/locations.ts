/** Shared helpers for the locations tree (denormalized floor_id, parent_id chain). */

export type LocationNode = {
  id: string
  floor_id: string
  parent_id: string | null
  type: string
}

/** Walks parent_id chain to the containing apartment (issues may sit on rooms).
 *  Returns null when the location has no apartment ancestor
 *  (e.g. folders or rooms outside apartments). */
export function apartmentAncestorId(
  locationId: string,
  byId: Map<string, LocationNode>
): string | null {
  let current = byId.get(locationId)
  let guard = 0
  while (current && guard++ < 20) {
    if (current.type === "apartment") return current.id
    current = current.parent_id ? byId.get(current.parent_id) : undefined
  }
  return null
}

/** Compact floor label for breadcrumbs: Dach / Parter / P3 / P-2. */
export function shortFloorLabel(level: number): string {
  if (level === 7) return "Dach"
  if (level === 0) return "Parter"
  return `P${level}`
}
