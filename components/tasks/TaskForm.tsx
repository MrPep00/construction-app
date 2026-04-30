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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createTask, updateTask } from "@/lib/actions/tasks"

type CreateMode = { mode: "create"; projectId: string; floorId?: string | null }
type EditMode = {
  mode: "edit"
  task: {
    id: string
    title: string
    description: string | null
    priority: number
    due_date: string | null
  }
}

type Props = (CreateMode | EditMode) & { onClose: () => void }

const PRIORITY_OPTIONS = [
  { value: "1", label: "1 — Wysoki" },
  { value: "2", label: "2 — Podwyższony" },
  { value: "3", label: "3 — Normalny" },
  { value: "4", label: "4 — Niski" },
  { value: "5", label: "5 — Bardzo niski" },
]

export function TaskForm(props: Props) {
  const initial = props.mode === "edit" ? props.task : null
  const [title, setTitle] = useState(initial?.title ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [priority, setPriority] = useState(String(initial?.priority ?? "3"))
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result =
        props.mode === "create"
          ? await createTask({
              projectId: props.projectId,
              floorId: props.floorId,
              title,
              description: description || undefined,
              priority: Number(priority),
              dueDate: dueDate || null,
            })
          : await updateTask(props.task.id, {
              title,
              description: description || null,
              priority: Number(priority),
              dueDate: dueDate || null,
            })

      if (result.error) {
        setError(result.error)
      } else {
        props.onClose()
      }
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
            <label className="text-sm font-medium">Opis (opcjonalny)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcjonalny opis zadania..."
              rows={3}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Priorytet</label>
            <Select value={priority} onValueChange={(v) => v && setPriority(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Termin (opcjonalny)</label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
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
