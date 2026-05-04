"use client"

import { useState, useTransition } from "react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { recordMovement } from "@/lib/actions/inventory"
import type { MovementReason } from "@/lib/types/db"

export type ItemOption = {
  id: string
  name: string
  unit: string
  pallet_qty?: number | null
}
export type FloorOption = { id: string; label: string }

interface Props {
  items: ItemOption[]
  floors: FloorOption[]
  defaultItemId?: string
  defaultFloorId?: string
  onClose: () => void
}

const REASONS: { value: MovementReason; label: string }[] = [
  { value: "delivery", label: "Dostawa" },
  { value: "consumption", label: "Zużycie" },
  { value: "correction", label: "Korekta" },
]

function formatPalletDisplay(qty: number, palletQty: number): string {
  const p = qty / palletQty
  if (p % 1 === 0) return `${p}`
  return p.toFixed(2).replace(/\.?0+$/, "")
}

export function MovementForm({
  items,
  floors,
  defaultItemId,
  defaultFloorId,
  onClose,
}: Props) {
  const [itemId, setItemId] = useState(defaultItemId ?? items[0]?.id ?? "")
  const [floorId, setFloorId] = useState(defaultFloorId ?? floors[0]?.id ?? "")
  const [quantity, setQuantity] = useState("")
  const [palletInput, setPalletInput] = useState("")
  const [reason, setReason] = useState<MovementReason>("delivery")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedItem = items.find((i) => i.id === itemId)
  const isNegative = reason === "consumption"
  const palletQty = selectedItem?.pallet_qty ?? null

  function handleItemChange(newId: string) {
    setItemId(newId)
    setQuantity("")
    setPalletInput("")
  }

  function handleQuantityChange(val: string) {
    setQuantity(val)
    const q = parseInt(val, 10)
    if (!isNaN(q) && q > 0 && palletQty) {
      setPalletInput(formatPalletDisplay(q, palletQty))
    } else if (val === "") {
      setPalletInput("")
    }
  }

  function handlePalletChange(val: string) {
    setPalletInput(val)
    const p = parseFloat(val)
    if (!isNaN(p) && p > 0 && palletQty) {
      setQuantity(String(Math.round(p * palletQty)))
    } else if (val === "") {
      setQuantity("")
    }
  }

  function handleSubmit() {
    const qty = parseInt(quantity, 10)
    if (isNaN(qty) || qty <= 0) {
      setError("Podaj poprawną ilość (liczba całkowita > 0)")
      return
    }
    const delta = isNegative ? -qty : qty
    setError(null)

    startTransition(async () => {
      const result = await recordMovement({
        itemId,
        floorId,
        delta,
        reason,
        note: note.trim() || undefined,
      })
      if (result.error) {
        setError(result.error)
      } else {
        toast.success("Ruch zarejestrowany")
        onClose()
      }
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !isPending) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nowy ruch magazynowy</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!defaultItemId && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Pozycja</label>
              <select
                value={itemId}
                onChange={(e) => handleItemChange(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.unit})
                    {item.pallet_qty ? ` · ${item.pallet_qty} szt/pal` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!defaultFloorId && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Piętro</label>
              <select
                value={floorId}
                onChange={(e) => setFloorId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {floors.map((floor) => (
                  <option key={floor.id} value={floor.id}>
                    {floor.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Powód</label>
            <div className="flex gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReason(r.value)}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    reason === r.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input hover:bg-muted"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Ilość{selectedItem ? ` (${selectedItem.unit})` : ""}
            </label>

            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "w-4 shrink-0 text-sm font-bold",
                  isNegative ? "text-red-500" : "text-green-600"
                )}
              >
                {isNegative ? "−" : "+"}
              </span>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                placeholder="0"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isPending && quantity.trim()) handleSubmit()
                }}
              />
            </div>

            {palletQty && (
              <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2.5 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Przelicznik: 1 paleta = {palletQty} {selectedItem?.unit}
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-muted-foreground">Palety</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={palletInput}
                      onChange={(e) => handlePalletChange(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <span className="mt-5 text-xs text-muted-foreground">→</span>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-muted-foreground">
                      {selectedItem?.unit ?? "szt"}
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => handleQuantityChange(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">
              Notatka{" "}
              <span className="font-normal text-muted-foreground">(opcjonalna)</span>
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Dostawca, nr WZ, uwagi..."
              rows={2}
            />
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Anuluj
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !quantity.trim()}>
            {isPending ? "Zapisywanie..." : "Zapisz ruch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
