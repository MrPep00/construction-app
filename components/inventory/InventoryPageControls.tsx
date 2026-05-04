"use client"

import { useState } from "react"
import { PlusIcon, ArrowUpDownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MovementForm, type ItemOption, type FloorOption } from "./MovementForm"
import { NewItemDialog } from "./NewItemDialog"

interface Props {
  projectId: string
  items: ItemOption[]
  floors: FloorOption[]
}

export function InventoryPageControls({ projectId, items, floors }: Props) {
  const [newItemOpen, setNewItemOpen] = useState(false)
  const [newMovementOpen, setNewMovementOpen] = useState(false)

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setNewItemOpen(true)}>
          <PlusIcon className="size-4" />
          Nowy materiał
        </Button>
        {items.length > 0 && (
          <Button size="sm" onClick={() => setNewMovementOpen(true)}>
            <ArrowUpDownIcon className="size-4" />
            Nowy ruch
          </Button>
        )}
      </div>

      {newItemOpen && (
        <NewItemDialog
          projectId={projectId}
          floors={floors}
          onClose={() => setNewItemOpen(false)}
        />
      )}

      {newMovementOpen && (
        <MovementForm
          items={items}
          floors={floors}
          onClose={() => setNewMovementOpen(false)}
        />
      )}
    </>
  )
}
