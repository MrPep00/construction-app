/** Shared scope mapping + ordering for task cards (kanban, mobile list, side panel). */

import {
  apartmentAncestorId,
  shortFloorLabel,
  type LocationNode,
} from "@/lib/locations"

export type TaskScopeType = "global" | "floor" | "location"

export type TaskScope = {
  scopeType: TaskScopeType
  /** e.g. "Ogólne", "P3", "M31 · P3" */
  scopeLabel: string
  /** Floor the task belongs to (via location for location-scoped); null = global */
  effectiveFloorId: string | null
  /** Floor level for ordering; null = global */
  effectiveFloorLevel: number | null
  /** Apartment/location name for pl-numeric collation; null = global/floor scope */
  locationSortName: string | null
}

export function buildTaskScope(
  task: { floor_id: string | null; location_id: string | null; floor_label?: string | null },
  locationById: Map<string, LocationNode & { name: string }>,
  floorLevelById: Map<string, number>
): TaskScope {
  if (task.location_id) {
    const loc = locationById.get(task.location_id)
    const aptId = apartmentAncestorId(task.location_id, locationById)
    const name = aptId
      ? (locationById.get(aptId)?.name ?? loc?.name ?? "?")
      : (loc?.name ?? "?")
    const level = loc ? floorLevelById.get(loc.floor_id) : undefined
    return {
      scopeType: "location",
      scopeLabel: level !== undefined ? `${name} · ${shortFloorLabel(level)}` : name,
      effectiveFloorId: loc?.floor_id ?? null,
      effectiveFloorLevel: level ?? null,
      locationSortName: name,
    }
  }
  if (task.floor_id) {
    const level = floorLevelById.get(task.floor_id)
    return {
      scopeType: "floor",
      scopeLabel:
        level !== undefined ? shortFloorLabel(level) : (task.floor_label ?? "Piętro"),
      effectiveFloorId: task.floor_id,
      effectiveFloorLevel: level ?? null,
      locationSortName: null,
    }
  }
  return {
    scopeType: "global",
    scopeLabel: "Ogólne",
    effectiveFloorId: null,
    effectiveFloorLevel: null,
    locationSortName: null,
  }
}

export type SortableTask = {
  scopeType: TaskScopeType
  effectiveFloorLevel: number | null
  locationSortName: string | null
  priority: number
  created_at: string
  updated_at: string
}

/** Shared todo+doing order: Ogólne first, then floors top-first (level desc),
 *  floor-scoped before apartments, apartments by pl-numeric name.
 *  Ties: priority asc, newest created first. */
export function compareActiveTasks(a: SortableTask, b: SortableTask): number {
  const aGlobal = a.scopeType === "global" ? 0 : 1
  const bGlobal = b.scopeType === "global" ? 0 : 1
  if (aGlobal !== bGlobal) return aGlobal - bGlobal

  if (aGlobal === 1) {
    const aLevel = a.effectiveFloorLevel ?? Number.NEGATIVE_INFINITY
    const bLevel = b.effectiveFloorLevel ?? Number.NEGATIVE_INFINITY
    if (aLevel !== bLevel) return bLevel - aLevel

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
