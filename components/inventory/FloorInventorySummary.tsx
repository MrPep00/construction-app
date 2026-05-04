import { createClient } from "@/lib/supabase/server"

interface Props {
  projectId: string
  floorId: string
}

export async function FloorInventorySummary({ projectId, floorId }: Props) {
  const supabase = await createClient()

  const { data: items } = await supabase
    .from("inventory_items")
    .select("id, name, unit")
    .eq("project_id", projectId)

  if (!items || items.length === 0) return null

  const itemIds = items.map((i) => i.id)

  const { data: levels } = await supabase
    .from("inventory_levels")
    .select("item_id, on_hand, required")
    .eq("floor_id", floorId)
    .in("item_id", itemIds)
    .gt("required", 0)

  const itemMap = new Map(items.map((i) => [i.id, i]))

  const shortfalls = (levels ?? [])
    .filter((l) => l.on_hand < l.required)
    .map((l) => ({
      item: itemMap.get(l.item_id),
      shortage: l.required - l.on_hand,
    }))
    .filter((s): s is { item: NonNullable<(typeof s)["item"]>; shortage: number } =>
      s.item !== undefined
    )

  if (shortfalls.length === 0) return null

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Braki materiałowe</h2>
      <div className="space-y-1.5">
        {shortfalls.map(({ item, shortage }) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm dark:border-orange-800/50 dark:bg-orange-950/30"
          >
            <span className="font-medium">{item.name}</span>
            <span className="text-orange-700 dark:text-orange-400">
              brak {shortage} {item.unit}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
