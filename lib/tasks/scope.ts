/** Shared scope mapping + ordering for task cards (kanban, mobile list, side panel). */

import {
  apartmentAncestorId,
  floorShortLabel,
  type LocationNode,
} from "@/lib/locations"

export type TaskScopeType = "global" | "floor" | "location"

/** Floor row shape the scope builder needs (level/label/kind for the display
 *  label, sort_order for ordering). */
export type FloorMeta = {
  level: number
  label: string
  kind: string
  sort_order: number
}

export type TaskScope = {
  scopeType: TaskScopeType
  /** e.g. "Ogólne", "P3", "M31 · P3", "Teren zewnętrzny" */
  scopeLabel: string
  /** Floor the task belongs to (via location for location-scoped); null = global */
  effectiveFloorId: string | null
  /** Canonical floor position for ordering (sort_order asc = top of list, zones last); null = global */
  effectiveFloorSort: number | null
  /** Apartment/location name for pl-numeric collation; null = global/floor scope */
  locationSortName: string | null
}

export function buildTaskScope(
  task: { floor_id: string | null; location_id: string | null; floor_label?: string | null },
  locationById: Map<string, LocationNode & { name: string }>,
  floorById: Map<string, FloorMeta>
): TaskScope {
  if (task.location_id) {
    const loc = locationById.get(task.location_id)
    const aptId = apartmentAncestorId(task.location_id, locationById)
    const name = aptId
      ? (locationById.get(aptId)?.name ?? loc?.name ?? "?")
      : (loc?.name ?? "?")
    const floor = loc ? floorById.get(loc.floor_id) : undefined
    return {
      scopeType: "location",
      scopeLabel: floor ? `${name} · ${floorShortLabel(floor)}` : name,
      effectiveFloorId: loc?.floor_id ?? null,
      effectiveFloorSort: floor?.sort_order ?? null,
      locationSortName: name,
    }
  }
  if (task.floor_id) {
    const floor = floorById.get(task.floor_id)
    return {
      scopeType: "floor",
      scopeLabel: floor ? floorShortLabel(floor) : (task.floor_label ?? "Piętro"),
      effectiveFloorId: task.floor_id,
      effectiveFloorSort: floor?.sort_order ?? null,
      locationSortName: null,
    }
  }
  return {
    scopeType: "global",
    scopeLabel: "Ogólne",
    effectiveFloorId: null,
    effectiveFloorSort: null,
    locationSortName: null,
  }
}

export type SortableTask = {
  scopeType: TaskScopeType
  effectiveFloorSort: number | null
  locationSortName: string | null
  priority: number
  created_at: string
  updated_at: string
}

/** Shared todo+doing order: Ogólne first, then floors top-first (sort_order
 *  asc, zones last), floor-scoped before apartments, apartments by pl-numeric
 *  name. Ties: priority asc, newest created first. */
export function compareActiveTasks(a: SortableTask, b: SortableTask): number {
  const aGlobal = a.scopeType === "global" ? 0 : 1
  const bGlobal = b.scopeType === "global" ? 0 : 1
  if (aGlobal !== bGlobal) return aGlobal - bGlobal

  if (aGlobal === 1) {
    const aSort = a.effectiveFloorSort ?? Number.POSITIVE_INFINITY
    const bSort = b.effectiveFloorSort ?? Number.POSITIVE_INFINITY
    if (aSort !== bSort) return aSort - bSort

    const aLoc = a.locationSortName
    const bLoc = b.locationSortName
    if ((aLoc === null) !== (bLoc === null)) return aLoc === null ? -1 : 1
    if (aLoc !== null && bLoc !== null) {
      const byName = aLoc.localeCompare(bLoc, "pl", { numeric: true })
      if (byName !== 0) return byName
    }
  }

  if (a.priority !== b.priority) return a.priority - b.priority
  return b.created_at.localeCompare(a.created_at)
}

/** Done sorts independently: most recently touched first. */
export function compareDoneTasks(a: SortableTask, b: SortableTask): number {
  return b.updated_at.localeCompare(a.updated_at)
}

/** "gleb.plotnikov00@example.com" -> "GP" */
export function initialsFromEmail(email: string): string {
  const parts = email
    .split("@")[0]
    .split(/[^\p{L}]+/u)
    .filter(Boolean)
  if (parts.length === 0) return email.slice(0, 2).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
