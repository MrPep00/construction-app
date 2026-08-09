"use client"

import { useOptimistic, useState, useTransition, useRef } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Trash2Icon, CheckIcon, XIcon, PencilIcon } from "lucide-react"
import { toast } from "sonner"
import { createNote, updateNote, deleteNote } from "@/lib/actions/notes"
import { shortFloorLabel } from "@/lib/locations"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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

export type NoteRow = {
  id: string
  body: string
  created_at: string
  updated_at: string
  floor_level: number | null
  author_email: string | null
  author_initials: string | null
}

type Author = { email: string; initials: string }
type FloorOption = { id: string; level: number }

interface Props {
  notes: NoteRow[]
  projectId: string
  floorId?: string | null
  /** Floors carrying notes, for filter chips; empty in floor-scoped mode */
  floorOptions: FloorOption[]
  /** ALL project floors (top-first) for the composer scope select */
  composerFloorOptions: FloorOption[]
  currentAuthor: Author | null
}

type NoteAction = { type: "add"; note: NoteRow } | { type: "remove"; id: string }

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
  showScope,
  onDelete,
}: {
  note: NoteRow
  showScope: boolean
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
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[10px] font-semibold text-brand"
            title={note.author_email ?? undefined}
          >
            {note.author_initials ?? "?"}
          </span>
          <div className="min-w-0">
            {note.author_email && (
              <p className="truncate text-xs font-medium">{note.author_email}</p>
            )}
            <time className="block text-xs text-muted-foreground">
              {formatDateTime(
                note.updated_at !== note.created_at ? note.updated_at : note.created_at
              )}
              {note.updated_at !== note.created_at && " (edytowana)"}
            </time>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {showScope && (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {note.floor_level === null ? "Globalna" : shortFloorLabel(note.floor_level)}
            </span>
          )}
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
      {/* TODO: optional note photo — needs files.note_id target (migration), deferred from P7 */}
    </div>
  )
}

export function NotesPanelClient({
  notes,
  projectId,
  floorId,
  floorOptions,
  composerFloorOptions,
  currentAuthor,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [newContent, setNewContent] = useState("")
  const [isPending, startTransition] = useTransition()
  const [deleteTarget, setDeleteTarget] = useState<NoteRow | null>(null)

  const [optimisticNotes, applyOptimistic] = useOptimistic(
    notes,
    (state: NoteRow[], action: NoteAction) =>
      action.type === "add"
        ? [action.note, ...state]
        : state.filter((n) => n.id !== action.id)
  )

  const unified = !floorId
  const [filter, setFilter] = useState<string>(() => searchParams.get("filter") ?? "all")

  // Composer scope: "global" or a floor id; inherits the active floor chip
  function scopeForFilter(filterValue: string): string {
    if (filterValue === "all" || filterValue === "global") return "global"
    return floorOptions.find((f) => String(f.level) === filterValue)?.id ?? "global"
  }
  const [scope, setScope] = useState<string>(() => scopeForFilter(filter))

  function updateFilter(value: string) {
    setFilter(value)
    setScope(scopeForFilter(value))
    const params = new URLSearchParams(searchParams)
    if (value === "all") params.delete("filter")
    else params.set("filter", value)
    router.replace(params.size > 0 ? `${pathname}?${params}` : pathname, {
      scroll: false,
    })
  }

  const visibleNotes = optimisticNotes.filter((n) => {
    if (!unified || filter === "all") return true
    if (filter === "global") return n.floor_level === null
    return String(n.floor_level) === filter
  })

  function handleCreate() {
    const content = newContent.trim()
    if (!content) return
    setNewContent("")
    const scopedFloor = unified
      ? (composerFloorOptions.find((f) => f.id === scope) ?? null)
      : null
    const targetFloorId = floorId ?? scopedFloor?.id ?? null
    startTransition(async () => {
      const now = new Date().toISOString()
      applyOptimistic({
        type: "add",
        note: {
          id: `temp-${crypto.randomUUID()}`,
          body: content,
          created_at: now,
          updated_at: now,
          floor_level: scopedFloor?.level ?? null,
          author_email: currentAuthor?.email ?? null,
          author_initials: currentAuthor?.initials ?? null,
        },
      })
      const result = await createNote({ projectId, floorId: targetFloorId, content })
      if (result.error) {
        toast.error(result.error)
        setNewContent(content)
      } else {
        router.refresh()
      }
    })
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    startTransition(async () => {
      applyOptimistic({ type: "remove", id: target.id })
      const result = await deleteNote(target.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Notatka usunięta")
        router.refresh()
      }
    })
  }

  const chips: { value: string; label: string }[] = [
    { value: "all", label: "Wszystkie" },
    { value: "global", label: "Globalne" },
    ...floorOptions.map((f) => ({
      value: String(f.level),
      label: shortFloorLabel(f.level),
    })),
  ]

  return (
    <>
      <div className="space-y-4">
        {unified && (
          <div
            className="flex items-center gap-1.5 overflow-x-auto pb-1"
            role="group"
            aria-label="Filtr notatek"
          >
            {chips.map((chip) => (
              <button
                key={chip.value}
                type="button"
                onClick={() => updateFilter(chip.value)}
                className={cn(
                  "min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors",
                  filter === chip.value
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {visibleNotes.length === 0 && (
          <p className="text-sm text-muted-foreground">Brak notatek.</p>
        )}

        <div className="space-y-3">
          {visibleNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              showScope={unified}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>

        {/* Composer pinned above the mobile bottom nav (3.5rem + safe area); free-standing on desktop */}
        <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 space-y-2 rounded-xl border bg-card p-3 shadow-sm lg:bottom-4">
          <Textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Dodaj notatkę..."
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleCreate()
            }}
          />
          <div className="flex items-center justify-end gap-2">
            {unified && (
              <Select
                value={scope}
                onValueChange={(v) => setScope(v ?? "global")}
                items={[
                  { value: "global", label: "Globalna" },
                  ...composerFloorOptions.map((f) => ({
                    value: f.id,
                    label: shortFloorLabel(f.level),
                  })),
                ]}
              >
                <SelectTrigger
                  size="sm"
                  className="w-auto min-w-28"
                  aria-label="Zakres notatki"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Globalna</SelectItem>
                  {composerFloorOptions.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {shortFloorLabel(f.level)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {/* TODO(D-029): mic button lands here (voice notes) */}
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={isPending || !newContent.trim()}
            >
              {isPending ? "Dodawanie..." : "Dodaj notatkę"}
            </Button>
          </div>
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
