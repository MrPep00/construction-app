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
import { createIssue, updateIssue } from "@/lib/actions/issues"
import { uploadIssuePhoto } from "@/lib/actions/files"
import type { IssueRow } from "./IssueListClient"

type CreateMode = { mode: "create"; locationId: string }
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFiles(Array.from(e.target.files ?? []))
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      if (props.mode === "create") {
        const result = await createIssue({
          locationId: props.locationId,
          title,
          description: description || undefined,
          contractor: contractor || undefined,
        })
        if (result.error) { setError(result.error); return }

        const issueId = result.data!.id
        for (const file of selectedFiles) {
          const fd = new FormData()
          fd.append("file", file)
          fd.append("locationId", props.locationId)
          fd.append("issueId", issueId)
          const r = await uploadIssuePhoto(fd)
          if (r.error) { setError(r.error); return }
        }
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
          <Button onClick={handleSubmit} disabled={isPending || !title.trim()}>
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
