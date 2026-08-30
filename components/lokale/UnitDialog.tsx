"use client"

import { useCallback, useId, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { getIssueStatusConfig } from "@/lib/status"
import {
  MATRIX_CELL_CLASS,
  MATRIX_CELL_LABEL_CLASS,
  MATRIX_LABEL_COMFORT_PX,
} from "@/components/dashboard/BuildingMatrix"
import {
  CATEGORY_LABELS,
  MAX_MATRIX_LABEL_LENGTH,
  TECHNICAL_ABBREVIATIONS,
  UNIT_CATEGORIES,
  suggestMatrixLabel,
} from "@/lib/lokale"
import type { UnitCategory } from "@/lib/types/db"
import { createUnit } from "@/lib/actions/lokale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

/** Matrix label already used on this floor (for the uniqueness warning). */
export type ExistingUnit = {
  id: string
  name: string
  matrixLabel: string | null
}

interface Props {
  floorId: string
  /** Units already on this floor — feeds suggestions + uniqueness warning */
  existingUnits: ExistingUnit[]
  onClose: () => void
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("pl")
}

export function UnitDialog({ floorId, existingUnits, onClose }: Props) {
  const router = useRouter()
  const datalistId = useId()

  const existingLabels = useMemo(
    () =>
      existingUnits
        .map((u) => u.matrixLabel)
        .filter((label): label is string => !!label),
    [existingUnits]
  )

  const [name, setName] = useState("")
  const [category, setCategory] = useState<UnitCategory>("residential")
  const [matrixLabel, setMatrixLabel] = useState(() =>
    suggestMatrixLabel("residential", "", existingLabels)
  )
  /** True once the user edits the field; a cleared field goes back to false
   *  so the suggestion returns on blur / category change. */
  const [labelTouched, setLabelTouched] = useState(false)
  const [labelWidth, setLabelWidth] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Callback ref + key on the span: React remounts the node whenever the
  // preview text changes, so the measurement re-runs without an effect.
  const measureLabel = useCallback((node: HTMLSpanElement | null) => {
    if (node) setLabelWidth(node.scrollWidth)
  }, [])

  function refreshSuggestion(
    nextCategory: UnitCategory,
    nextName: string
  ) {
    if (labelTouched) return
    setMatrixLabel(suggestMatrixLabel(nextCategory, nextName, existingLabels))
  }

  function handleNameChange(value: string) {
    setName(value)
    refreshSuggestion(category, value)
  }

  function handleCategoryChange(next: UnitCategory) {
    setCategory(next)
    refreshSuggestion(next, name)
  }

  function handleLabelChange(value: string) {
    setMatrixLabel(value)
    setLabelTouched(value.trim() !== "")
  }

  function handleLabelBlur() {
    if (matrixLabel.trim() === "") {
      setMatrixLabel(suggestMatrixLabel(category, name, existingLabels))
      setLabelTouched(false)
    }
  }

  const trimmedLabel = matrixLabel.trim()
  const previewLabel = trimmedLabel || name.trim() || "—"

  const duplicate = existingUnits.find(
    (u) => u.matrixLabel && normalize(u.matrixLabel) === normalize(trimmedLabel)
  )
  const freeLabel = duplicate
    ? suggestMatrixLabel(category, name, existingLabels)
    : null

  const tooWide = labelWidth > MATRIX_LABEL_COMFORT_PX

  const cleanCell = getIssueStatusConfig("resolved").cellClass
  const issueCell = getIssueStatusConfig("open").cellClass

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await createUnit({
        floorId,
        name: name.trim(),
        category,
        matrixLabel: trimmedLabel,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
      onClose()
    })
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isPending) onClose()
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dodaj lokal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="unit-name" className="text-sm font-medium">
              Nazwa
            </label>
            <Input
              id="unit-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={
                category === "technical" ? "Węzeł cieplny" : "Mieszkanie 12"
              }
              list={category === "technical" ? datalistId : undefined}
              autoFocus
              className="h-11"
            />
            {category === "technical" && (
              <datalist id={datalistId}>
                {Object.keys(TECHNICAL_ABBREVIATIONS).map((room) => (
                  <option key={room} value={room} />
                ))}
              </datalist>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">Kategoria</p>
            <div className="flex flex-wrap gap-2">
              {UNIT_CATEGORIES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleCategoryChange(value)}
                  aria-pressed={category === value}
                  className={cn(
                    "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
                    category === value
                      ? "border-brand bg-brand text-on-brand"
                      : "border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {CATEGORY_LABELS[value]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="unit-matrix-label" className="text-sm font-medium">
              Skrót w matrycy
            </label>
            <Input
              id="unit-matrix-label"
              value={matrixLabel}
              onChange={(e) => handleLabelChange(e.target.value)}
              onBlur={handleLabelBlur}
              maxLength={MAX_MATRIX_LABEL_LENGTH}
              className="h-11 w-32"
            />
            <p className="text-xs text-muted-foreground">
              Widoczny w matrycy budynku. Pusty skrót = pełna nazwa lokalu.
            </p>
            {duplicate && (
              <p className="text-xs text-status-open">
                Skrót „{trimmedLabel}” jest już użyty ({duplicate.name}). Wolny:{" "}
                {freeLabel}
              </p>
            )}
            {tooWide && (
              <p className="text-xs text-status-open">
                Skrót może rozpychać komórkę matrycy
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">Podgląd komórki</p>
            <div className="flex items-center gap-3">
              <div className={cn(MATRIX_CELL_CLASS, "w-[5.5rem]", cleanCell)}>
                <span
                  key={previewLabel}
                  ref={measureLabel}
                  className={MATRIX_CELL_LABEL_CLASS}
                >
                  {previewLabel}
                </span>
              </div>
              <div className={cn(MATRIX_CELL_CLASS, "w-[5.5rem]", issueCell)}>
                <span className={MATRIX_CELL_LABEL_CLASS}>{previewLabel}</span>
                <span className="text-sm font-semibold tabular-nums">3</span>
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Anuluj
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || name.trim() === ""}
          >
            {isPending ? "Zapisywanie..." : "Dodaj lokal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
