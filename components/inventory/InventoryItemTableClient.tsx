"use client"

import { Fragment, useState, useTransition } from "react"
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
import { shortFloorLabel } from "@/lib/locations"
import { MovementForm, type FloorOption } from "./MovementForm"

export type ItemMovement = {
  id: string
  delta: number
  reason: string
  note: string | null
  created_at: string
  floor_level: number | null
}

export type InventoryItemRow = {
  id: string
  name: string
  unit: string
  pallet_qty: number | null
  totalOnHand: number
  totalRequired: number
  perFloor: { floorId: string; level: number; on_hand: number; required: number }[]
  movements: ItemMovement[]
}

interface Props {
  rows: InventoryItemRow[]
  floors: FloorOption[]
  movementsCapped: boolean
}

type DialogState =
  | { type: "movement"; itemId: string; floorId?: string }
  | { type: "setRequired"; itemId: string; floorId: string; currentRequired: number }
  | { type: "deleteItem"; item: InventoryItemRow }
  | null

const REASON_LABELS: Record<string, string> = {
  delivery: "Dostawa",
  consumption: "Zużycie",
  correction: "Korekta",
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
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function isShort(onHand: number, required: number) {
  return required > 0 && onHand < required
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
      setError("Podaj wartość ≥ 0")
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await updateRequired({ itemId, floorId, required: num })
      if (result.error) setError(result.error)
      else {
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
            onKeyDown={(e) => { if (e.key === "Enter" && !isPending) handleSubmit() }}
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

function StockCell({ row }: { row: InventoryItemRow }) {
  return (
    <div>
      <span
        className={cn(
          "font-mono text-sm tabular-nums",
          isShort(row.totalOnHand, row.totalRequired) && "font-semibold text-destructive"
        )}
      >
        {row.totalOnHand} / {row.totalRequired}
      </span>
      {row.pallet_qty && (
        <p className="text-xs text-muted-foreground tabular-nums">
          = {palStr(row.totalOnHand, row.pallet_qty)} pal.
        </p>
      )}
    </div>
  )
}

function PerFloorBreakdown({ row }: { row: InventoryItemRow }) {
  if (row.perFloor.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return (
    <span className="text-xs tabular-nums">
      {row.perFloor.map((f, i) => (
        <Fragment key={f.floorId}>
          {i > 0 && <span className="text-muted-foreground"> · </span>}
          <span
            className={cn(
              isShort(f.on_hand, f.required)
                ? "font-semibold text-destructive"
                : "text-muted-foreground"
            )}
          >
            {shortFloorLabel(f.level)}: {f.on_hand}
          </span>
        </Fragment>
      ))}
    </span>
  )
}

function LastMovement({ row }: { row: InventoryItemRow }) {
  const last = row.movements[0]
  if (!last) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className="whitespace-nowrap text-xs text-muted-foreground">
      <span
        className={cn(
          "font-mono font-medium tabular-nums",
          last.delta > 0 ? "text-status-resolved" : "text-destructive"
        )}
      >
        {last.delta > 0 ? "+" : ""}
        {last.delta}
      </span>{" "}
      · {REASON_LABELS[last.reason] ?? last.reason} · {formatDateTime(last.created_at)}
    </span>
  )
}

function ExpandedPanel({
  row,
  onAction,
}: {
  row: InventoryItemRow
  onAction: (state: DialogState) => void
}) {
  return (
    <div className="space-y-4 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          Stan per piętro (dostępne / wymagane)
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => onAction({ type: "movement", itemId: row.id })}
          >
            Nowy ruch
          </Button>
          <button
            type="button"
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Usuń pozycję"
            onClick={() => onAction({ type: "deleteItem", item: row })}
          >
            <Trash2Icon className="size-3.5" />
          </button>
        </div>
      </div>

      {row.perFloor.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Materiał nieprzypisany do pięter — użyj „Nowy ruch”.
        </p>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {row.perFloor.map((f) => (
            <div
              key={f.floorId}
              className="flex min-h-11 items-center justify-between gap-3 px-3 py-2"
            >
              <span className="text-sm">{shortFloorLabel(f.level)}</span>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "font-mono text-sm tabular-nums",
                    isShort(f.on_hand, f.required)
                      ? "font-semibold text-destructive"
                      : "text-muted-foreground"
                  )}
                >
                  {f.on_hand} / {f.required}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() =>
                    onAction({ type: "movement", itemId: row.id, floorId: f.floorId })
                  }
                >
                  Ruch
                </Button>
                <button
                  type="button"
                  className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Ustaw zapotrzebowanie"
                  onClick={() =>
                    onAction({
                      type: "setRequired",
                      itemId: row.id,
                      floorId: f.floorId,
                      currentRequired: f.required,
                    })
                  }
                >
                  <PencilIcon className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Historia ruchów</p>
        {row.movements.length === 0 ? (
          <p className="text-xs text-muted-foreground">Brak ruchów.</p>
        ) : (
          <div className="divide-y rounded-lg border bg-card">
            {row.movements.map((m) => (
              <div
                key={m.id}
                className="flex items-start justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs">
                    {m.floor_level !== null ? shortFloorLabel(m.floor_level) : "—"} ·{" "}
                    {REASON_LABELS[m.reason] ?? m.reason}
                  </p>
                  {m.note && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{m.note}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={cn(
                      "font-mono text-sm font-medium tabular-nums",
                      m.delta > 0 ? "text-status-resolved" : "text-destructive"
                    )}
                  >
                    {m.delta > 0 ? "+" : ""}
                    {m.delta} {row.unit}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(m.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function InventoryItemTableClient({ rows, floors, movementsCapped }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<DialogState>(null)
  const [, startTransition] = useTransition()

  const items = rows.map((r) => ({
    id: r.id,
    name: r.name,
    unit: r.unit,
    pallet_qty: r.pallet_qty,
  }))

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleDeleteConfirm(item: InventoryItemRow) {
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
      {/* Desktop: table */}
      <div className="hidden overflow-x-auto rounded-xl border md:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Materiał
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Stan łączny
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Jedn.
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Per piętro
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Ostatni ruch
              </th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isOpen = expanded.has(row.id)
              return (
                <Fragment key={row.id}>
                  <tr
                    className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                    onClick={() => toggle(row.id)}
                  >
                    <td className="px-3 py-2.5 font-medium">{row.name}</td>
                    <td className="px-3 py-2.5">
                      <StockCell row={row} />
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {row.unit}
                    </td>
                    <td className="px-3 py-2.5">
                      <PerFloorBreakdown row={row} />
                    </td>
                    <td className="px-3 py-2.5">
                      <LastMovement row={row} />
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <ChevronDownIcon
                        className={cn(
                          "size-4 text-muted-foreground transition-transform duration-150",
                          isOpen && "rotate-180"
                        )}
                      />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b bg-muted/20 last:border-0">
                      <td colSpan={6}>
                        <ExpandedPanel row={row} onAction={setDialog} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <div className="space-y-2 md:hidden">
        {rows.map((row) => {
          const isOpen = expanded.has(row.id)
          return (
            <div key={row.id} className="overflow-hidden rounded-xl border">
              <button
                type="button"
                onClick={() => toggle(row.id)}
                className="flex min-h-11 w-full items-start justify-between gap-3 px-3 py-2.5 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {row.name}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      {row.unit}
                    </span>
                  </p>
                  <div className="mt-0.5">
                    <PerFloorBreakdown row={row} />
                  </div>
                  <div className="mt-0.5">
                    <LastMovement row={row} />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right">
                    <StockCell row={row} />
                  </div>
                  <ChevronDownIcon
                    className={cn(
                      "size-4 text-muted-foreground transition-transform duration-150",
                      isOpen && "rotate-180"
                    )}
                  />
                </div>
              </button>
              {isOpen && (
                <div className="border-t bg-muted/20">
                  <ExpandedPanel row={row} onAction={setDialog} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {movementsCapped && (
        <p className="mt-2 text-xs text-muted-foreground">
          Historia ruchów ograniczona do ostatnich 300 wpisów łącznie.
        </p>
      )}

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
