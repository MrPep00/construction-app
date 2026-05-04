import { createClient } from "@/lib/supabase/server"
import {
  InventoryFloorListClient,
  type LevelCell,
} from "./InventoryFloorListClient"
import type { ItemOption } from "./MovementForm"

interface Props {
  projectId: string
}

export async function InventoryFloorList({ projectId }: Props) {
  const supabase = await createClient()

  const [{ data: floorsData }, { data: itemsData }] = await Promise.all([
    supabase
      .from("floors")
      .select("id, level, label")
      .eq("project_id", projectId)
      .order("level", { ascending: false }),
    supabase
      .from("inventory_items")
      .select("id, name, unit")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
  ])

  const floors = floorsData?.map((f) => ({ id: f.id, level: f.level, label: f.label })) ?? []
  const items: ItemOption[] = itemsData ?? []

  const matrix: Record<string, Record<string, LevelCell | undefined>> = {}
  floors.forEach((f) => { matrix[f.id] = {} })

  if (items.length > 0) {
    const itemIds = items.map((i) => i.id)
    const { data: levelsData } = await supabase
      .from("inventory_levels")
      .select("id, item_id, floor_id, on_hand, required")
      .in("item_id", itemIds)

    levelsData?.forEach((l) => {
      if (!matrix[l.floor_id]) matrix[l.floor_id] = {}
      matrix[l.floor_id][l.item_id] = {
        id: l.id,
        on_hand: l.on_hand,
        required: l.required,
      }
    })
  }

  return <InventoryFloorListClient floors={floors} items={items} matrix={matrix} />
}
