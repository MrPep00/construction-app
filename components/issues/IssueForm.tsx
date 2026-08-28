"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { createIssue, updateIssue } from "@/lib/actions/issues"
import { uploadIssuePhoto } from "@/lib/actions/files"
import type { IssueRow } from "./IssueListClient"

export type IssueFloorOption = { id: string; level: number; label: string }
export type IssueApartmentOption = { id: string; name: string; floorId: string }

type CreateMode = {
  mode: "create"
  /** Known target (location page). When absent, the floor→apartment picker renders. */
  locationId?: string
  floors?: IssueFloorOption[]
  apartments?: IssueApartmentOption[]
  /** Optimistic-create hooks: add a temp row before the server call, swap in the
   *  real id on success, remove on failure (P4 pattern extended to create). */
  onOptimisticAdd?: (issue: IssueRow) => void
  onOptimisticReplace?: (tempId: string, issue: IssueRow) => void
  onOptimisticRemove?: (tempId: string) => void
}
type EditMode = { mode: "edit"; issue: IssueRow; locationId: string }

type Props = (CreateMode | EditMode) & { onClose: () => void }

export function IssueForm(props: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const initial = props.mode === "edit" ? props.issue : null

  const [title, setTitle] = useState(initial?.title ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [contractor, setContractor] = useState(initial?.contractor ?? "")
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const showTargetPicker = props.mode === "create" && !props.locationId
  const floors = props.mode === "create" ? (props.floors ?? []) : []
  const apartments = props.mode === "create" ? (props.apartments ?? []) : []

  const [targetFloorId, setTargetFloorId] = useState(floors[0]?.id ?? "")
  const [targetLocationId, setTargetLocationId] = useState("")
  const floorApartments = apartments.filter((a) => a.floorId === targetFloorId)

  const effectiveLocationId =
    props.mode === "edit"
      ? props.locationId
      : (props.locationId ?? targetLocationId)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFiles(Array.from(e.target.files ?? []))
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      if (props.mode === "create") {
        const tempId = `temp-${crypto.randomUUID()}`
        props.onOptimisticAdd?.({
          id: tempId,
          title: title.trim(),
          description: description || null,
          contractor: contractor || null,
          status: "open",
          created_at: new Date().toISOString(),
          photos: [],
        })

        const result = await createIssue({
          locationId: effectiveLocationId,
          title,
          description: description || undefined,
          contractor: contractor || undefined,
        })
        if (result.error) {
          props.onOptimisticRemove?.(tempId)
          setError(result.error)
          return
        }

        const issueId = result.data!.id
        props.onOptimisticReplace?.(tempId, {
          id: issueId,
          title: title.trim(),
          description: description || null,
          contractor: contractor || null,
          status: "open",
          created_at: new Date().toISOString(),
          photos: [],
        })
        for (const file of selectedFiles) {
          const fd = new FormData()
          fd.append("file", file)
          fd.append("locationId", effectiveLocationId)
          fd.append("issueId", issueId)
          const r = await uploadIssuePhoto(fd)
          if (r.error) { setError(r.error); return }
        }
        toast.success("Usterka dodana")
      } else {
        const result = await updateIssue(props.issue.id, {
          title,
          description: description || undefined,
          contractor: contractor || undefined,
        })
        if (result.error) { setError(result.error); return }
      }

      router.refresh()
      props.onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !isPending) props.onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? "Nowa usterka" : "Edytuj usterkę"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {showTargetPicker && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Piętro</label>
                <Select
                  value={targetFloorId}
                  onValueChange={(v) => {
                    if (!v) return
                    setTargetFloorId(v)
                    setTargetLocationId("")
                  }}
                  items={floors.map((f) => ({ value: f.id, label: f.label }))}
                >
                  <SelectTrigger className="min-h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {floors.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Mieszkanie</label>
                <Select
                  value={targetLocationId || null}
                  onValueChange={(v) => { if (v) setTargetLocationId(v) }}
                  disabled={floorApartments.length === 0}
                  items={floorApartments.map((a) => ({
                    value: a.id,
                    label: a.name,
                  }))}
                >
                  <SelectTrigger className="min-h-11 w-full">
                    <SelectValue
                      placeholder={
                        floorApartments.length === 0
                          ? "Brak mieszkań"
                          : "Wybierz mieszkanie"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {floorApartments.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">Krótki opis</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Pęknięcie tynku — ściana N"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isPending && title.trim()) handleSubmit()
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Podwykonawca</label>
            <Input
              value={contractor}
              onChange={(e) => setContractor(e.target.value)}
              placeholder="np. Firma Budowlana ABC"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Pełny opis</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Szczegółowy opis usterki..."
              rows={3}
            />
          </div>

          {props.mode === "create" && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Zdjęcia</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFiles.length > 0
                  ? `Wybrano ${selectedFiles.length} ${selectedFiles.length === 1 ? "zdjęcie" : "zdjęć"}`
                  : "Dodaj zdjęcia"}
              </Button>
              {selectedFiles.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {selectedFiles.map((f, i) => (
                    <img
                      key={i}
                      src={URL.createObjectURL(f)}
                      alt={f.name}
                      className="aspect-square w-full rounded object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={props.onClose} disabled={isPending}>
            Anuluj
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !title.trim() || !effectiveLocationId}
          >
            {isPending
              ? props.mode === "create" && selectedFiles.length > 0
                ? "Zapisywanie zdjęć..."
                : "Zapisywanie..."
              : "Zapisz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
