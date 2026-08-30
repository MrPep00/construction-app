"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UnitDialog, type ExistingUnit } from "./UnitDialog"

interface Props {
  floorId: string
  existingUnits: ExistingUnit[]
}

/** "Dodaj lokal" trigger on the floor page. Any team member may add a lokal. */
export function AddUnitButton({ floorId, existingUnits }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon className="size-4" />
        Dodaj lokal
      </Button>

      {open && (
        <UnitDialog
          mode={{ kind: "create", floorId }}
          existingUnits={existingUnits}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
