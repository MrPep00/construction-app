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
import {
  createLocation,
  renameLocation,
  deleteLocation,
} from "@/lib/actions/locations"

export type DialogMode =
  | { type: "create-subfolder"; parentId: string; floorId: string }
  | { type: "create-apartment"; parentId: string; floorId: string }
  | { type: "rename"; locationId: string; currentName: string }
  | { type: "delete"; locationId: string; name: string }

interface Props {
  mode: DialogMode
  onClose: () => void
}

const TITLES: Record<DialogMode["type"], string> = {
  "create-subfolder": "Nowy podfolder",
  "create-apartment": "Nowe mieszkanie",
  rename: "Zmień nazwę",
  delete: "Usuń lokalizację",
}

const PLACEHOLDERS: Partial<Record<DialogMode["type"], string>> = {
  "create-subfolder": "Pomieszczenie",
  "create-apartment": "M12",
  rename: "",
}

export function LocationDialog({ mode, onClose }: Props) {
  const [name, setName] = useState(
    mode.type === "rename" ? mode.currentName : ""
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isDelete = mode.type === "delete"

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      let result: { error?: string; data?: unknown }

      if (mode.type === "create-subfolder") {
        result = await createLocation({
          floorId: mode.floorId,
          parentId: mode.parentId,
          type: "folder",
          name,
        })
      } else if (mode.type === "create-apartment") {
        result = await createLocation({
          floorId: mode.floorId,
          parentId: mode.parentId,
          type: "apartment",
          name,
        })
      } else if (mode.type === "rename") {
        result = await renameLocation(mode.locationId, name)
      } else {
        result = await deleteLocation(mode.locationId)
      }

      if (result.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !isPending) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{TITLES[mode.type]}</DialogTitle>
        </DialogHeader>

        {isDelete ? (
          <p className="text-sm text-muted-foreground">
            Usunąć <strong>{(mode as Extract<DialogMode, { type: "delete" }>).name}</strong> i wszystkie elementy w środku? Tej operacji nie można cofnąć.
          </p>
        ) : (
          <div className="space-y-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={PLACEHOLDERS[mode.type] ?? ""}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isPending && name.trim()) handleSubmit()
              }}
              autoFocus
            />
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isPending}
          >
            Anuluj
          </Button>
          <Button
            variant={isDelete ? "destructive" : "default"}
            onClick={handleSubmit}
            disabled={isPending || (!isDelete && !name.trim())}
          >
            {isPending
              ? isDelete
                ? "Usuwanie..."
                : "Zapisywanie..."
              : isDelete
                ? "Usuń"
                : "Zapisz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
