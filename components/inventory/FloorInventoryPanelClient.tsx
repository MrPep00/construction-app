"use client"

import { useState, useTransition } from "react"
import { cn } from "@/lib/utils"
import { PencilIcon } from "lucide-react"
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
import { updateRequired } from "@/lib/actions/inventory"
import { MovementForm, type ItemOption, type FloorOption } from "./MovementForm"

type LevelCell = { id: string; on_hand: number; required: number }

export type MovementRow = {
  id: string
  itemName: string
  itemUnit: string
  delta: number
  reason: string
  note: string | null
  created_at: string
}

interface Props {
  items: ItemOption[]
  floors: FloorOption[]
  cells: Record<string, LevelCell | undefined>
  movements: MovementRow[]
  floorId: string
}

type DialogState =
  | { type: "movement"; itemId: string }
  | { type: "setRequired"; itemId: string; currentRequired: number }
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

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("pl-PL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
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

export function FloorInventoryPanelClient({
  items,
  floors,
  cells,
  movements,
  floorId,
}: Props) {
  const [dialog, setDialog] = useState<DialogState>(null)

  const floorItems = items.filter((item) => cells[item.id] !== undefined)

  if (floorItems.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-muted-foreground">Brak materiałów przypisanych do tego piętra.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Przejdź do Inwentaryzacji projektu i użyj "Nowy ruch", aby przypisać materiał.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Items list */}
      <div className="mb-6 overflow-hidden rounded-lg border">
        <div className="border-b bg-muted/50 px-4 py-2">
          <p className="text-xs font-medium text-muted-foreground">Stan materiałów</p>
        </div>
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
                  <p className="text-sm font-medium leading-snug">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.unit}</p>
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
                    onClick={() => setDialog({ type: "movement", itemId: item.id })}
                  >
                    Ruch
                  </Button>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Ustaw zapotrzebowanie"
                    onClick={() =>
                      setDialog({
                        type: "setRequired",
                        itemId: item.id,
                        currentRequired: required,
                      })
                    }
                  >
                    <PencilIcon className="size-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent movements */}
      {movements.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <div className="border-b bg-muted/50 px-4 py-2">
            <p className="text-xs font-medium text-muted-foreground">
              Ostatnie ruchy ({movements.length})
            </p>
          </div>
          <div className="divide-y">
            {movements.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 px-4 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{m.itemName}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.reason}
                    {m.note && ` · ${m.note}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={cn(
                      "font-mono text-sm font-medium tabular-nums",
                      m.delta > 0 ? "text-green-600" : "text-red-500"
                    )}
                  >
                    {m.delta > 0 ? "+" : ""}
                    {m.delta} {m.itemUnit}
                  </span>
                  <p className="text-xs text-muted-foreground">{formatDateTime(m.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {dialog?.type === "movement" && (
        <MovementForm
          items={items}
          floors={floors}
          defaultItemId={dialog.itemId}
          defaultFloorId={floorId}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.type === "setRequired" && (
        <SetRequiredDialog
          itemId={dialog.itemId}
          floorId={floorId}
          currentRequired={dialog.currentRequired}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  )
}
