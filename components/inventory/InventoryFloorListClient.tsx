"use client"

import { useState, useTransition } from "react"
import { cn } from "@/lib/utils"
import { ChevronDownIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateRequired, deleteItem } from "@/lib/actions/inventory"
import { MovementForm, type ItemOption, type FloorOption } from "./MovementForm"

export type LevelCell = { id: string; on_hand: number; required: number }

type FloorRow = FloorOption & { level: number }

interface Props {
  floors: FloorRow[]
  items: ItemOption[]
  matrix: Record<string, Record<string, LevelCell | undefined>>
}

type DialogState =
  | { type: "movement"; itemId: string; floorId: string }
  | { type: "setRequired"; itemId: string; floorId: string; currentRequired: number }
  | { type: "deleteItem"; item: ItemOption }
  | null

function cellColor(cell: LevelCell | undefined) {
  if (!cell || cell.required === 0) return "text-muted-foreground"
  if (cell.on_hand >= cell.required) return "text-green-600 dark:text-green-400"
  if (cell.on_hand === 0) return "text-red-500"
  return "text-yellow-600 dark:text-yellow-400"
}

function palStr(qty: number, palletQty: number): string {
  const p = qty / palletQty
  if (p % 1 === 0) return `${p}`
  return p.toFixed(1).replace(/\.0$/, "")
}

function SetRequiredDialog({
  itemId,
  floorId,
  currentRequired,
  onClose,
}: {
  itemId: string
  floorId: string
  currentRequired: number
  onClose: () => void
}) {
  const [value, setValue] = useState(String(currentRequired))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 0) { setError("Podaj wartość ≥ 0"); return }
    setError(null)
    startTransition(async () => {
      const result = await updateRequired({ itemId, floorId, required: num })
      if (result.error) setError(result.error)
      else { toast.success("Zapotrzebowanie zaktualizowane"); onClose() }
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !isPending) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ustaw zapotrzebowanie</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <label className="text-sm font-medium">Zapotrzebowanie</label>
          <Input
            type="number"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter" && !isPending) handleSubmit() }}
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Anuluj</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Zapisywanie..." : "Zapisz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FloorExpanded({
  floorId,
  items,
  cells,
  onEdit,
}: {
  floorId: string
  items: ItemOption[]
  cells: Record<string, LevelCell | undefined>
  onEdit: (state: DialogState) => void
}) {
  const floorItems = items.filter((item) => cells[item.id] !== undefined)

  if (floorItems.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        Brak przypisanych materiałów. Użyj &quot;Nowy ruch&quot;, aby przypisać materiał do tego piętra.
      </p>
    )
  }

  return (
    <div className="divide-y">
      {floorItems.map((item) => {
        const cell = cells[item.id]!
        const onHand = cell.on_hand
        const required = cell.required

        return (
          <div
            key={item.id}
            className="flex min-h-[44px] items-center justify-between gap-3 px-4 py-2.5"
          >
            <div className="min-w-0">
              <span className="text-sm font-medium">{item.name}</span>
              <span className="ml-1.5 text-xs text-muted-foreground">{item.unit}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="text-right">
                <span className={cn("font-mono text-sm tabular-nums", cellColor(cell))}>
                  {onHand} / {required}
                </span>
                {item.pallet_qty && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {palStr(onHand, item.pallet_qty)} / {palStr(required, item.pallet_qty)} pal
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() => onEdit({ type: "movement", itemId: item.id, floorId })}
              >
                Ruch
              </Button>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Ustaw zapotrzebowanie"
                onClick={() =>
                  onEdit({
                    type: "setRequired",
                    itemId: item.id,
                    floorId,
                    currentRequired: required,
                  })
                }
              >
                <PencilIcon className="size-3.5" />
              </button>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Usuń pozycję"
                onClick={() => onEdit({ type: "deleteItem", item })}
              >
                <Trash2Icon className="size-3.5" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function InventoryFloorListClient({ floors, items, matrix }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<DialogState>(null)
  const [, startTransition] = useTransition()

  function handleDeleteConfirm(item: ItemOption) {
    startTransition(async () => {
      const result = await deleteItem(item.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`"${item.name}" usunięty`)
        setDialog(null)
      }
    })
  }

  function toggle(floorId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(floorId)) next.delete(floorId)
      else next.add(floorId)
      return next
    })
  }

  function getFloorBadge(floorId: string) {
    const cells = matrix[floorId] ?? {}
    const withDemand = items.filter((i) => {
      const c = cells[i.id]
      return c && c.required > 0
    })
    const shortfalls = withDemand.filter((i) => {
      const c = cells[i.id]!
      return c.on_hand < c.required
    })
    return { total: withDemand.length, shortfalls: shortfalls.length }
  }

  return (
    <>
      <div className="space-y-1.5">
        {floors.map((floor) => {
          const isOpen = expanded.has(floor.id)
          const { total, shortfalls } = getFloorBadge(floor.id)
          const cells = matrix[floor.id] ?? {}

          return (
            <div key={floor.id} className="overflow-hidden rounded-lg border">
              <button
                type="button"
                onClick={() => toggle(floor.id)}
                className="flex w-full min-h-[44px] items-center justify-between px-4 py-2.5 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                <span>{floor.label}</span>
                <div className="flex items-center gap-2">
                  {shortfalls > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      brak {shortfalls}
                    </span>
                  )}
                  {total > 0 && shortfalls === 0 && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      OK
                    </span>
                  )}
                  {total === 0 && (
                    <span className="text-xs text-muted-foreground">brak danych</span>
                  )}
                  <ChevronDownIcon
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
                      isOpen && "rotate-180"
                    )}
                  />
                </div>
              </button>

              {isOpen && (
                <div className="border-t bg-muted/10">
                  <FloorExpanded
                    floorId={floor.id}
                    items={items}
                    cells={cells}
                    onEdit={setDialog}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {dialog?.type === "movement" && (
        <MovementForm
          items={items}
          floors={floors}
          defaultItemId={dialog.itemId}
          defaultFloorId={dialog.floorId}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.type === "setRequired" && (
        <SetRequiredDialog
          itemId={dialog.itemId}
          floorId={dialog.floorId}
          currentRequired={dialog.currentRequired}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.type === "deleteItem" && (
        <Dialog open onOpenChange={(open) => { if (!open) setDialog(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Usuń pozycję</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Usunąć <strong>{dialog.item.name}</strong>? Wszystkie stany i historia ruchów
              zostaną usunięte ze wszystkich pięter. Tej operacji nie można cofnąć.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>
                Anuluj
              </Button>
              <Button variant="destructive" onClick={() => handleDeleteConfirm(dialog.item)}>
                Usuń
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
