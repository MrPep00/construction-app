"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"
import { createZone } from "@/lib/actions/floors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const TOP = "top"

interface Props {
  projectId: string
  /** Current floor list in canonical display order (top first, zones last) */
  floors: { id: string; label: string }[]
}

/** Admin-only "Dodaj strefę" — inserts a manual zone at a chosen position. */
export function AddZoneButton({ projectId, floors }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState("")
  // Default: bottom of the list (below the last row)
  const [position, setPosition] = useState<string>(
    () => floors[floors.length - 1]?.id ?? TOP
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const positionItems = [
    { value: TOP, label: "Na górze" },
    ...floors.map((f) => ({ value: f.id, label: `Pod „${f.label}”` })),
  ]

  function close() {
    if (isPending) return
    setOpen(false)
    setLabel("")
    setError(null)
    setPosition(floors[floors.length - 1]?.id ?? TOP)
  }

  function handleSubmit() {
    const trimmed = label.trim()
    if (!trimmed) {
      setError("Nazwa jest wymagana")
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createZone({
        projectId,
        label: trimmed,
        afterFloorId: position === TOP ? null : position,
      })
      if (result.error) {
        setError(result.error)
      } else {
        toast.success(`Strefa „${trimmed}” dodana`)
        setOpen(false)
        setLabel("")
        router.refresh()
      }
    })
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => setOpen(true)}
      >
        <PlusIcon className="size-4" />
        Dodaj strefę
      </Button>

      {open && (
        <Dialog open onOpenChange={(o) => { if (!o) close() }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nowa strefa</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Nazwa</label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Elewacja"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isPending && label.trim()) handleSubmit()
                  }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Pozycja na liście</label>
                <Select
                  value={position}
                  onValueChange={(v) => setPosition(v ?? TOP)}
                  items={positionItems}
                >
                  <SelectTrigger className="min-h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {positionItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={isPending}>
                Anuluj
              </Button>
              <Button onClick={handleSubmit} disabled={isPending || !label.trim()}>
                {isPending ? "Dodawanie..." : "Dodaj strefę"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
