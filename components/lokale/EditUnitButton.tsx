"use client"

import { useState } from "react"
import { PencilIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { UnitDialog, type ExistingUnit } from "./UnitDialog"
import type { UnitCategory } from "@/lib/types/db"

interface Props {
  unit: {
    id: string
    name: string
    category: UnitCategory | null
    matrixLabel: string | null
  }
  /** Compact floor label for the dialog header (e.g. "P3") */
  floorLabel: string
  /** Other units on this floor (self excluded) */
  existingUnits: ExistingUnit[]
}

/** Pencil in the location page header — opens the same dialog as "Dodaj
 *  lokal" in edit mode. Units created before migration 024 have no category
 *  in the DB; the dialog falls back to 'residential' (the 024 backfill). */
export function EditUnitButton({ unit, floorLabel, existingUnits }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "shrink-0"
        )}
        aria-label={`Edytuj lokal ${unit.name}`}
        title="Edytuj lokal"
      >
        <PencilIcon className="size-4" />
      </button>

      {open && (
        <UnitDialog
          mode={{
            kind: "edit",
            id: unit.id,
            name: unit.name,
            category: unit.category,
            matrixLabel: unit.matrixLabel,
          }}
          floorLabel={floorLabel}
          existingUnits={existingUnits}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
