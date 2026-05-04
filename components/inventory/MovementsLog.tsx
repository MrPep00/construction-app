import { createClient } from "@/lib/supabase/server"

const REASON_LABELS: Record<string, string> = {
  delivery: "Dostawa",
  consumption: "Zużycie",
  correction: "Korekta",
}

interface Props {
  projectId: string
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export async function MovementsLog({ projectId }: Props) {
  const supabase = await createClient()

  const [{ data: floorsData }, { data: itemsData }] = await Promise.all([
    supabase
      .from("floors")
      .select("id, label")
      .eq("project_id", projectId),
    supabase
      .from("inventory_items")
      .select("id, name, unit")
      .eq("project_id", projectId),
  ])

  const itemMap = new Map(itemsData?.map((i) => [i.id, i]) ?? [])
  const floorMap = new Map(floorsData?.map((f) => [f.id, f]) ?? [])
  const itemIds = itemsData?.map((i) => i.id) ?? []

  if (itemIds.length === 0) {
    return <p className="text-sm text-muted-foreground">Brak ruchów.</p>
  }

  const { data: movements } = await supabase
    .from("inventory_movements")
    .select("id, item_id, floor_id, delta, reason, note, created_at")
    .in("item_id", itemIds)
    .order("created_at", { ascending: false })
    .limit(100)

  if (!movements || movements.length === 0) {
    return <p className="text-sm text-muted-foreground">Brak ruchów.</p>
  }

  return (
    <div>
      {/* Desktop: table */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Data
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Pozycja
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Piętro
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                Zmiana
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Powód
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Notatka
              </th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => {
              const item = itemMap.get(m.item_id)
              const floor = floorMap.get(m.floor_id)
              return (
                <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {formatDateTime(m.created_at)}
                  </td>
                  <td className="px-3 py-2">
                    <span>{item?.name ?? "—"}</span>
                    {item && (
                      <span className="ml-1 text-xs text-muted-foreground">{item.unit}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {floor?.label ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-center font-mono font-medium tabular-nums">
                    <span className={m.delta > 0 ? "text-green-600" : "text-red-500"}>
                      {m.delta > 0 ? "+" : ""}
                      {m.delta}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {REASON_LABELS[m.reason] ?? m.reason}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {m.note ?? ""}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <div className="space-y-2 md:hidden">
        {movements.map((m) => {
          const item = itemMap.get(m.item_id)
          const floor = floorMap.get(m.floor_id)
          return (
            <div key={m.id} className="rounded-lg border px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {floor?.label ?? "—"} · {REASON_LABELS[m.reason] ?? m.reason}
                  </p>
                  {m.note && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{m.note}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={`font-mono text-sm font-bold tabular-nums ${m.delta > 0 ? "text-green-600" : "text-red-500"}`}
                  >
                    {m.delta > 0 ? "+" : ""}
                    {m.delta} {item?.unit}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(m.created_at)}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Ostatnie {movements.length} ruchów
      </p>
    </div>
  )
}
