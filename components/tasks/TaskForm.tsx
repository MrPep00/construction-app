"use client"

import { useRef, useState, useTransition } from "react"
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
import { PaperclipIcon, XIcon } from "lucide-react"
import { createTask, updateTask } from "@/lib/actions/tasks"
import { uploadFileForTask } from "@/lib/actions/files"

type CreateMode = { mode: "create"; projectId: string; floorId?: string | null }
type EditMode = {
  mode: "edit"
  task: {
    id: string
    title: string
    description: string | null
  }
}

type Props = (CreateMode | EditMode) & { onClose: () => void }

export function TaskForm(props: Props) {
  const initial = props.mode === "edit" ? props.task : null
  const [title, setTitle] = useState(initial?.title ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    setPendingFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size))
      return [...prev, ...selected.filter((f) => !existing.has(f.name + f.size))]
    })
    e.target.value = ""
  }

  function removeFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      let taskId: string | undefined

      if (props.mode === "create") {
        const result = await createTask({
          projectId: props.projectId,
          floorId: props.floorId,
          title,
          description: description || undefined,
          priority: 3,
          dueDate: null,
        })
        if (result.error) { setError(result.error); return }
        taskId = result.data?.id
      } else {
        const result = await updateTask(props.task.id, {
          title,
          description: description || null,
        })
        if (result.error) { setError(result.error); return }
        taskId = props.task.id
      }

      if (taskId && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          const fd = new FormData()
          fd.append("file", file)
          fd.append("taskId", taskId)
          const result = await uploadFileForTask(fd)
          if (result.error) {
            setError(`Błąd uploadu "${file.name}": ${result.error}`)
            return
          }
        }
      }

      props.onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !isPending) props.onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? "Nowe zadanie" : "Edytuj zadanie"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Tytuł</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Zamówić bloczek silikatowy..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isPending && title.trim()) handleSubmit()
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Opis <span className="text-muted-foreground font-normal">(opcjonalny)</span></label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcjonalny opis zadania..."
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFilesChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPending}
            >
              <PaperclipIcon className="size-4" />
              Dodaj pliki
            </Button>

            {pendingFiles.length > 0 && (
              <ul className="space-y-1">
                {pendingFiles.map((file, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1 text-xs">
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label={`Usuń ${file.name}`}
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={props.onClose} disabled={isPending}>
            Anuluj
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !title.trim()}>
            {isPending ? "Zapisywanie..." : "Zapisz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
