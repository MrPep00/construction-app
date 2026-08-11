"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PencilIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { renameZone, deleteZone } from "@/lib/actions/floors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

interface Props {
  floorId: string
  projectId: string
  label: string
}

/** Admin-only rename/delete controls on a zone's floor page.
 *  Delete is blocked server-side while the zone carries data — the action's
 *  error message (with counts) is surfaced in the confirm dialog. */
export function ZoneActions({ floorId, projectId, label }: Props) {
  const router = useRouter()
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null)
  const [name, setName] = useState(label)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function close() {
    if (isPending) return
    setDialog(null)
    setName(label)
    setError(null)
  }

  function handleRename() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Nazwa jest wymagana")
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await renameZone({ floorId, label: trimmed })
      if (result.error) {
        setError(result.error)
      } else {
        toast.success("Nazwa strefy zmieniona")
        setDialog(null)
        router.refresh()
      }
    })
  }

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteZone({ floorId })
      if (result.error) {
        setError(result.error)
      } else {
        toast.success(`Strefa „${label}” usunięta`)
        router.push(`/projects/${projectId}`)
        router.refresh()
      }
    })
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setDialog("rename")}
          aria-label="Zmień nazwę strefy"
          title="Zmień nazwę strefy"
        >
          <PencilIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setDialog("delete")}
          aria-label="Usuń strefę"
          title="Usuń strefę"
        >
          <Trash2Icon className="size-4" />
        </Button>
      </div>

      {dialog === "rename" && (
        <Dialog open onOpenChange={(o) => { if (!o) close() }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Zmień nazwę strefy</DialogTitle>
            </DialogHeader>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isPending && name.trim()) handleRename()
              }}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={isPending}>
                Anuluj
              </Button>
              <Button onClick={handleRename} disabled={isPending || !name.trim()}>
                {isPending ? "Zapisywanie..." : "Zapisz"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {dialog === "delete" && (
        <Dialog open onOpenChange={(o) => { if (!o) close() }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Usunąć strefę „{label}”?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Tej operacji nie można cofnąć. Strefę można usunąć tylko wtedy,
              gdy nie zawiera lokalizacji, plików, zadań ani notatek.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={isPending}>
                Anuluj
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isPending}
              >
                {isPending ? "Usuwanie..." : "Usuń strefę"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
