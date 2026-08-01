import { createClient } from "@/lib/supabase/server"
import {
  InventoryItemTableClient,
  type InventoryItemRow,
  type ItemMovement,
} from "./InventoryItemTableClient"
import type { FloorOption } from "./MovementForm"

interface Props {
  projectId: string
}

const MOVEMENTS_LIMIT = 300

export async function InventoryItemTable({ projectId }: Props) {
  const supabase = await createClient()

  const [{ data: floorsData }, { data: itemsData }] = await Promise.all([
    supabase
      .from("floors")
      .select("id, level, label")
      .eq("project_id", projectId)
      .order("level", { ascending: false }),
    supabase
      .from("inventory_items")
      .select("id, name, unit, pallet_qty")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
  ])

  const floors = floorsData ?? []
  const floorOptions: FloorOption[] = floors.map((f) => ({ id: f.id, label: f.label }))
  const levelByFloorId = new Map(floors.map((f) => [f.id, f.level]))
  const items = itemsData ?? []

  if (items.length === 0) {
    return <InventoryItemTableClient rows={[]} floors={floorOptions} movementsCapped={false} />
  }

  const itemIds = items.map((i) => i.id)
  const [{ data: levelsData }, { data: movementsData }] = await Promise.all([
    supabase
      .from("inventory_levels")
      .select("item_id, floor_id, on_hand, required")
      .in("item_id", itemIds),
    supabase
      .from("inventory_movements")
      .select("id, item_id, floor_id, delta, reason, note, created_at")
      .in("item_id", itemIds)
      .order("created_at", { ascending: false })
      .limit(MOVEMENTS_LIMIT),
  ])

  const movementsByItem = new Map<string, ItemMovement[]>()
  movementsData?.forEach((m) => {
    const list = movementsByItem.get(m.item_id) ?? []
    list.push({
      id: m.id,
      delta: m.delta,
      reason: m.reason,
      note: m.note,
      created_at: m.created_at,
      floor_level: levelByFloorId.get(m.floor_id) ?? null,
    })
    movementsByItem.set(m.item_id, list)
  })

  const levelsByItem = new Map<string, { floorId: string; level: number; on_hand: number; required: number }[]>()
  levelsData?.forEach((l) => {
    const level = levelByFloorId.get(l.floor_id)
    if (level === undefined) return
    const list = levelsByItem.get(l.item_id) ?? []
    list.push({ floorId: l.floor_id, level, on_hand: l.on_hand, required: l.required })
    levelsByItem.set(l.item_id, list)
  })

  const rows: InventoryItemRow[] = items.map((item) => {
    const perFloor = (levelsByItem.get(item.id) ?? []).sort((a, b) => b.level - a.level)
    return {
      id: item.id,
      name: item.name,
      unit: item.unit,
      pallet_qty: item.pallet_qty ?? null,
      totalOnHand: perFloor.reduce((sum, f) => sum + f.on_hand, 0),
      totalRequired: perFloor.reduce((sum, f) => sum + f.required, 0),
      perFloor,
      movements: movementsByItem.get(item.id) ?? [],
    }
  })

  return (
    <InventoryItemTableClient
      rows={rows}
      floors={floorOptions}
      movementsCapped={(movementsData?.length ?? 0) >= MOVEMENTS_LIMIT}
    />
  )
}
