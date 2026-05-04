"use client"

import { useState, useTransition } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { createItem } from "@/lib/actions/inventory"
import type { FloorOption } from "./MovementForm"

const UNIT_SUGGESTIONS = ["szt", "m2", "m3", "kg", "mb", "paleta", "opak"]

interface Props {
  projectId: string
  floors: FloorOption[]
  onClose: () => void
}

export function NewItemDialog({ projectId, floors, onClose }: Props) {
  const [name, setName] = useState("")
  const [unit, setUnit] = useState("")
  const [palletQty, setPalletQty] = useState("")
  const [floorId, setFloorId] = useState("")
  const [required, setRequired] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    if (!name.trim() || !unit.trim()) {
      setError("Wypełnij nazwę i jednostkę")
      return
    }
    const parsedPalletQty = palletQty ? parseInt(palletQty, 10) : undefined
    if (palletQty && (isNaN(parsedPalletQty!) || parsedPalletQty! <= 0)) {
      setError("Sztuk na palecie musi być liczbą większą od 0")
      return
    }
    const initialRequired = floorId && required ? parseInt(required, 10) : undefined
    setError(null)

    startTransition(async () => {
      const result = await createItem({
        projectId,
        name: name.trim(),
        unit: unit.trim(),
        palletQty: parsedPalletQty,
        initialFloorId: floorId || undefined,
        initialRequired:
          initialRequired && !isNaN(initialRequired) ? initialRequired : undefined,
      })
      if (result.error) {
        setError(result.error)
      } else {
        toast.success(`"${name.trim()}" dodany`)
        onClose()
      }
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !isPending) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nowy materiał</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nazwa</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bloczek silikatowy 24cm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isPending && name.trim() && unit.trim()) handleSubmit()
              }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Jednostka</label>
            <Input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="szt"
              list="unit-suggestions"
            />
            <datalist id="unit-suggestions">
              {UNIT_SUGGESTIONS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            <div className="flex flex-wrap gap-1.5">
              {UNIT_SUGGESTIONS.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-muted transition-colors"
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">
              Sztuk na palecie{" "}
              <span className="font-normal text-muted-foreground">(opcjonalne)</span>
            </label>
            <Input
              type="number"
              min="1"
              value={palletQty}
              onChange={(e) => setPalletQty(e.target.value)}
              placeholder="np. 24"
            />
            {palletQty && !isNaN(parseInt(palletQty)) && parseInt(palletQty) > 0 && (
              <p className="text-xs text-muted-foreground">
                1 paleta = {palletQty} {unit || "szt"} · formularz ruchów pokaże przelicznik
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">
              Piętro{" "}
              <span className="font-normal text-muted-foreground">(opcjonalne)</span>
            </label>
            <select
              value={floorId}
              onChange={(e) => setFloorId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— brak —</option>
              {floors.map((floor) => (
                <option key={floor.id} value={floor.id}>
                  {floor.label}
                </option>
              ))}
            </select>
          </div>

          {floorId && (
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Zapotrzebowanie na tym piętrze{" "}
                <span className="font-normal text-muted-foreground">(opcjonalne)</span>
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  value={required}
                  onChange={(e) => setRequired(e.target.value)}
                  placeholder="0"
                  className="flex-1"
                />
                {palletQty && required && !isNaN(parseInt(required)) && !isNaN(parseInt(palletQty)) && parseInt(palletQty) > 0 && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    = {(parseInt(required) / parseInt(palletQty)).toFixed(1)} pal
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Anuluj
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !name.trim() || !unit.trim()}
          >
            {isPending ? "Dodawanie..." : "Dodaj"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
