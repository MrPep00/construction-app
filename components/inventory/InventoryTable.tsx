import { createClient } from "@/lib/supabase/server"
import {
  InventoryTableClient,
  type LevelCell,
  type MatrixRow,
} from "./InventoryTableClient"
import type { FloorOption } from "./MovementForm"

interface Props {
  projectId: string
}

export async function InventoryTable({ projectId }: Props) {
  const supabase = await createClient()

  const [{ data: floorsData }, { data: itemsData }] = await Promise.all([
    supabase
      .from("floors")
      .select("id, level, label")
      .eq("project_id", projectId)
      .order("level", { ascending: true }),
    supabase
      .from("inventory_items")
      .select("id, name, unit")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
  ])

  const floors: FloorOption[] = floorsData?.map((f) => ({ id: f.id, label: f.label })) ?? []
  const items = itemsData ?? []

  if (items.length === 0) {
    return <InventoryTableClient rows={[]} floors={floors} />
  }

  const itemIds = items.map((i) => i.id)
  const { data: levelsData } = await supabase
    .from("inventory_levels")
    .select("id, item_id, floor_id, on_hand, required")
    .in("item_id", itemIds)

  const levelMap = new Map<string, LevelCell>()
  levelsData?.forEach((l) => {
    levelMap.set(`${l.item_id}:${l.floor_id}`, {
      id: l.id,
      on_hand: l.on_hand,
      required: l.required,
    })
  })

  const rows: MatrixRow[] = items.map((item) => ({
    item,
    cells: Object.fromEntries(
      floors.map((floor) => [floor.id, levelMap.get(`${item.id}:${floor.id}`)])
    ),
  }))

  return <InventoryTableClient rows={rows} floors={floors} />
}
