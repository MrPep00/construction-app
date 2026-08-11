import { createClient } from "@/lib/supabase/server"
import { sortFloorsForDisplay } from "@/lib/floors"
import {
  FloorInventoryPanelClient,
  type MovementRow,
} from "./FloorInventoryPanelClient"
import type { ItemOption, FloorOption } from "./MovementForm"

const REASON_LABELS: Record<string, string> = {
  delivery: "Dostawa",
  consumption: "Zużycie",
  correction: "Korekta",
}

interface Props {
  projectId: string
  floorId: string
}

export async function FloorInventoryPanel({ projectId, floorId }: Props) {
  const supabase = await createClient()

  const [{ data: itemsData }, { data: floorsData }] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("id, name, unit, pallet_qty")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    supabase
      .from("floors")
      .select("id, label, kind, sort_order")
      .eq("project_id", projectId),
  ])

  const items: ItemOption[] = itemsData ?? []
  // Same visual order as before 023: bottom floor first, zones last
  const floors: FloorOption[] = sortFloorsForDisplay(
    floorsData ?? [],
    "bottomFirst"
  ).map((f) => ({ id: f.id, label: f.label }))

  const cells: Record<string, { id: string; on_hand: number; required: number } | undefined> = {}
  const movements: MovementRow[] = []

  if (items.length > 0) {
    const itemIds = items.map((i) => i.id)
    const itemMap = new Map(items.map((i) => [i.id, i]))

    const [{ data: levelsData }, { data: movementsData }] = await Promise.all([
      supabase
        .from("inventory_levels")
        .select("id, item_id, on_hand, required")
        .eq("floor_id", floorId)
        .in("item_id", itemIds),
      supabase
        .from("inventory_movements")
        .select("id, item_id, delta, reason, note, created_at")
        .eq("floor_id", floorId)
        .in("item_id", itemIds)
        .order("created_at", { ascending: false })
        .limit(15),
    ])

    levelsData?.forEach((l) => {
      cells[l.item_id] = { id: l.id, on_hand: l.on_hand, required: l.required }
    })

    movementsData?.forEach((m) => {
      const item = itemMap.get(m.item_id)
      movements.push({
        id: m.id,
        itemName: item?.name ?? "—",
        itemUnit: item?.unit ?? "",
        delta: m.delta,
        reason: REASON_LABELS[m.reason] ?? m.reason,
        note: m.note,
        created_at: m.created_at,
      })
    })
  }

  return (
    <FloorInventoryPanelClient
      items={items}
      floors={floors}
      cells={cells}
      movements={movements}
      floorId={floorId}
    />
  )
}
