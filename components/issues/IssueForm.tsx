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
import { createIssue, updateIssue } from "@/lib/actions/issues"
import type { IssueSeverity } from "@/lib/types/db"

type CreateMode = { mode: "create"; locationId: string }
type EditMode = {
  mode: "edit"
  issue: {
    id: string
    title: string
    description: string | null
    severity: IssueSeverity
  }
}

type Props = (CreateMode | EditMode) & { onClose: () => void }

const SEVERITY_OPTIONS: { value: IssueSeverity; label: string; className: string }[] = [
  { value: "low", label: "Niska", className: "text-gray-500" },
  { value: "normal", label: "Normalna", className: "text-blue-600" },
  { value: "high", label: "Wysoka", className: "text-orange-600" },
  { value: "critical", label: "Krytyczna", className: "text-red-600" },
]

export function IssueForm(props: Props) {
  const initial = props.mode === "edit" ? props.issue : null
  const [title, setTitle] = useState(initial?.title ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [severity, setSeverity] = useState<IssueSeverity>(initial?.severity ?? "normal")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result =
        props.mode === "create"
          ? await createIssue({
              locationId: props.locationId,
              title,
              description: description || undefined,
              severity,
            })
          : await updateIssue(props.issue.id, {
              title,
              description: description || undefined,
              severity,
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
            {props.mode === "create" ? "Nowa usterka" : "Edytuj usterkę"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Tytuł</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Pęknięcie tynku — ściana N"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isPending && title.trim()) handleSubmit()
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Opis</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcjonalny opis usterki..."
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Waga</label>
            <Select
              value={severity}
              onValueChange={(val) => setSeverity(val as IssueSeverity)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className={opt.className}>{opt.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
