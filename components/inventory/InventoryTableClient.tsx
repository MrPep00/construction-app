"use client"

import { useState, useTransition } from "react"
import { cn } from "@/lib/utils"
import { PencilIcon, Trash2Icon } from "lucide-react"
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
export type MatrixRow = { item: ItemOption; cells: Record<string, LevelCell | undefined> }

interface Props {
  rows: MatrixRow[]
  floors: FloorOption[]
}

type DialogState =
  | { type: "movement"; itemId: string; floorId: string }
  | { type: "setRequired"; itemId: string; floorId: string; currentRequired: number }
  | { type: "deleteItem"; item: ItemOption }
  | null

function getCellBg(cell: LevelCell | undefined): string {
  if (!cell || cell.required === 0) return ""
  if (cell.on_hand >= cell.required) return "bg-green-50 dark:bg-green-950/30"
  if (cell.on_hand === 0) return "bg-red-50 dark:bg-red-950/30"
  return "bg-yellow-50 dark:bg-yellow-950/30"
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
    if (isNaN(num) || num < 0) {
      setError("Podaj poprawną wartość (liczba ≥ 0)")
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await updateRequired({ itemId, floorId, required: num })
      if (result.error) {
        setError(result.error)
      } else {
        toast.success("Zapotrzebowanie zaktualizowane")
        onClose()
      }
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
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isPending) handleSubmit()
            }}
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Anuluj
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Zapisywanie..." : "Zapisz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function InventoryTableClient({ rows, floors }: Props) {
  const [dialog, setDialog] = useState<DialogState>(null)
  const [, startTransition] = useTransition()

  const items = rows.map((r) => r.item)

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

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Brak pozycji. Dodaj pierwszą pozycję przyciskiem powyżej.
      </p>
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th
                className="sticky left-0 z-10 bg-muted/80 px-3 py-2 text-left text-xs font-medium text-muted-foreground backdrop-blur-sm"
                style={{ minWidth: "160px" }}
              >
                Pozycja
              </th>
              {floors.map((floor) => (
                <th
                  key={floor.id}
                  className="px-2 py-2 text-center text-xs font-medium text-muted-foreground whitespace-nowrap"
                  style={{ minWidth: "80px" }}
                >
                  {floor.label}
                </th>
              ))}
              <th
                className="px-2 py-2 text-xs font-medium text-muted-foreground"
                style={{ minWidth: "44px" }}
              />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.item.id} className="group border-b last:border-0">
                <td
                  className="sticky left-0 z-10 bg-background px-3 py-2 font-medium group-hover:bg-muted/30 transition-colors"
                  style={{ minWidth: "160px" }}
                >
                  <span
                    className="block truncate text-sm"
                    style={{ maxWidth: "160px" }}
                    title={row.item.name}
                  >
                    {row.item.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{row.item.unit}</span>
                </td>
                {floors.map((floor) => {
                  const cell = row.cells[floor.id]
                  return (
                    <td
                      key={floor.id}
                      className={cn(
                        "relative px-1 py-1 text-center group-hover:brightness-95 transition-all",
                        getCellBg(cell)
                      )}
                      style={{ minWidth: "80px" }}
                    >
                      <button
                        type="button"
                        className="flex w-full flex-col items-center rounded px-1 py-1 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        onClick={() =>
                          setDialog({
                            type: "movement",
                            itemId: row.item.id,
                            floorId: floor.id,
                          })
                        }
                        title="Dodaj ruch"
                      >
                        <span className="font-medium tabular-nums">{cell?.on_hand ?? 0}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          / {cell?.required ?? 0}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="absolute right-0.5 top-0.5 rounded p-0.5 text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted transition-all"
                        title="Ustaw zapotrzebowanie"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDialog({
                            type: "setRequired",
                            itemId: row.item.id,
                            floorId: floor.id,
                            currentRequired: cell?.required ?? 0,
                          })
                        }}
                      >
                        <PencilIcon className="size-2.5" />
                      </button>
                    </td>
                  )
                })}
                <td className="px-2 py-2 text-center" style={{ minWidth: "44px" }}>
                  <button
                    type="button"
                    onClick={() => setDialog({ type: "deleteItem", item: row.item })}
                    className="rounded p-1 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Usuń pozycję"
                  >
                    <Trash2Icon className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Kliknij komórkę → dodaj ruch · Ikona ołówka (góra prawo) → ustaw zapotrzebowanie
      </p>

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
              zostaną usunięte. Tej operacji nie można cofnąć.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>
                Anuluj
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDeleteConfirm(dialog.item)}
              >
                Usuń
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
