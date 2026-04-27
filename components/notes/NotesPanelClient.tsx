"use client"

import { useState, useTransition, useRef } from "react"
import { Trash2Icon, CheckIcon, XIcon, PencilIcon } from "lucide-react"
import { toast } from "sonner"
import { createNote, updateNote, deleteNote } from "@/lib/actions/notes"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

export type NoteRow = {
  id: string
  body: string
  created_at: string
  updated_at: string
}

interface Props {
  notes: NoteRow[]
  projectId: string
  floorId?: string | null
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function NoteCard({
  note,
  onDelete,
}: {
  note: NoteRow
  onDelete: (note: NoteRow) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(note.body)
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function startEdit() {
    setValue(note.body)
    setEditing(true)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  function cancelEdit() {
    setValue(note.body)
    setEditing(false)
  }

  function saveEdit() {
    if (!value.trim() || value === note.body) {
      setEditing(false)
      return
    }
    startTransition(async () => {
      const result = await updateNote(note.id, value.trim())
      if (result.error) {
        toast.error(result.error)
      } else {
        setEditing(false)
      }
    })
  }

  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <time className="text-xs text-muted-foreground">
          {formatDateTime(note.updated_at !== note.created_at ? note.updated_at : note.created_at)}
          {note.updated_at !== note.created_at && " (edytowana)"}
        </time>
        <div className="flex items-center gap-0.5">
          {!editing && (
            <Button variant="ghost" size="icon-sm" onClick={startEdit} aria-label="Edytuj">
              <PencilIcon className="size-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(note)}
            aria-label="Usuń"
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={4}
            className="text-sm"
            onKeyDown={(e) => {
              if (e.key === "Escape") cancelEdit()
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) saveEdit()
            }}
          />
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={isPending}>
              <XIcon className="size-3.5" />
              Anuluj
            </Button>
            <Button size="sm" onClick={saveEdit} disabled={isPending || !value.trim()}>
              <CheckIcon className="size-3.5" />
              {isPending ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </div>
        </div>
      ) : (
        <p
          className="cursor-text whitespace-pre-wrap text-sm leading-relaxed"
          onClick={startEdit}
          title="Kliknij aby edytować"
        >
          {note.body}
        </p>
      )}
    </div>
  )
}

export function NotesPanelClient({ notes: initialNotes, projectId, floorId }: Props) {
  const [newContent, setNewContent] = useState("")
  const [isPending, startTransition] = useTransition()
  const [deleteTarget, setDeleteTarget] = useState<NoteRow | null>(null)

  function handleCreate() {
    if (!newContent.trim()) return
    startTransition(async () => {
      const result = await createNote({
        projectId,
        floorId,
        content: newContent.trim(),
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        setNewContent("")
      }
    })
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteNote(deleteTarget.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Notatka usunięta")
        setDeleteTarget(null)
      }
    })
  }

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Dodaj notatkę..."
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleCreate()
            }}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={isPending || !newContent.trim()}
            >
              {isPending ? "Dodawanie..." : "Dodaj notatkę"}
            </Button>
          </div>
        </div>

        {initialNotes.length === 0 && (
          <p className="text-sm text-muted-foreground">Brak notatek.</p>
        )}

        <div className="space-y-3">
          {initialNotes.map((note) => (
            <NoteCard key={note.id} note={note} onDelete={setDeleteTarget} />
          ))}
        </div>
      </div>

      {deleteTarget && (
        <Dialog open onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Usuń notatkę</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Usunąć tę notatkę? Tej operacji nie można cofnąć.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Anuluj
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm}>
                Usuń
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
