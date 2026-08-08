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

type InputUnit = "base" | "pallet"

function formatPallets(qty: number, palletQty: number): string {
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
  const [inputUnit, setInputUnit] = useState<InputUnit>("base")
  const [reason, setReason] = useState<MovementReason>("delivery")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedItem = items.find((i) => i.id === itemId)
  const isNegative = reason === "consumption"
  const palletQty = selectedItem?.pallet_qty ?? null
  const baseUnit = selectedItem?.unit ?? "szt"

  function handleItemChange(newId: string) {
    setItemId(newId)
    setQuantity("")
    const next = items.find((i) => i.id === newId)
    if (!next?.pallet_qty) setInputUnit("base")
  }

  /** Entered quantity converted to base units (storage stays in base units). */
  function toBaseQty(): number | null {
    if (inputUnit === "pallet") {
      if (!palletQty) return null
      const p = parseFloat(quantity)
      if (isNaN(p) || p <= 0) return null
      return Math.round(p * palletQty)
    }
    const q = parseInt(quantity, 10)
    if (isNaN(q) || q <= 0) return null
    return q
  }

  const baseQty = toBaseQty()

  function handleSubmit() {
    if (baseQty === null) {
      setError(
        inputUnit === "pallet"
          ? "Podaj poprawną liczbę palet (> 0)"
          : "Podaj poprawną ilość (liczba całkowita > 0)"
      )
      return
    }
    const delta = isNegative ? -baseQty : baseQty
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
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium">
                Ilość ({inputUnit === "pallet" ? "pal" : baseUnit})
              </label>
              <div
                className="flex gap-1"
                role="group"
                aria-label="Jednostka ilości"
              >
                {([
                  { value: "base", label: baseUnit, disabled: false },
                  { value: "pallet", label: "pal", disabled: !palletQty },
                ] as const).map((u) => (
                  <button
                    key={u.value}
                    type="button"
                    disabled={u.disabled}
                    onClick={() => {
                      setInputUnit(u.value)
                      setQuantity("")
                    }}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                      inputUnit === u.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input hover:bg-muted",
                      u.disabled && "cursor-not-allowed opacity-50 hover:bg-transparent"
                    )}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "w-4 shrink-0 text-sm font-bold",
                  isNegative ? "text-destructive" : "text-status-resolved"
                )}
              >
                {isNegative ? "−" : "+"}
              </span>
              <Input
                type="number"
                min={inputUnit === "pallet" ? "0.5" : "1"}
                step={inputUnit === "pallet" ? "0.5" : "1"}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isPending && quantity.trim()) handleSubmit()
                }}
              />
            </div>

            {palletQty && (
              <p className="text-xs text-muted-foreground">
                Przelicznik: 1 pal. = {palletQty} {baseUnit}
                {baseQty !== null && (
                  <>
                    {" · "}
                    <span className="font-medium text-foreground">
                      {baseQty} {baseUnit} = {formatPallets(baseQty, palletQty)} pal.
                    </span>
                  </>
                )}
              </p>
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
