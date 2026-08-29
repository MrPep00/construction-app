"use client"

import { useState, useTransition } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { markErrorResolved, markErrorUnresolved } from "@/lib/actions/admin-errors"
import { RelativeTime } from "@/components/RelativeTime"
import { formatAbsolutePl } from "@/lib/dates"
import type { ErrorLog } from "@/lib/supabase/admin-context"

const SEVERITY_STYLES = {
  warn: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  fatal: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
} as const

const SEVERITY_LABELS = {
  warn: "Ostrzeżenie",
  error: "Błąd",
  fatal: "Krytyczny",
} as const

export function ErrorCard({ log }: { log: ErrorLog }) {
  const [expanded, setExpanded] = useState(false)
  const [resolveOpen, setResolveOpen] = useState(false)
  const [note, setNote] = useState("")
  const [isPending, startTransition] = useTransition()

  const absoluteTime = formatAbsolutePl(new Date(log.occurred_at))

  function handleResolve() {
    startTransition(async () => {
      await markErrorResolved(log.id, note.trim() || undefined)
      setResolveOpen(false)
      setNote("")
    })
  }

  function handleUnresolve() {
    startTransition(async () => {
      await markErrorUnresolved(log.id)
    })
  }

  return (
    <div
      className={`rounded-lg border bg-card text-card-foreground shadow-sm transition-opacity ${isPending ? "opacity-60" : ""} ${log.resolved ? "border-muted" : ""}`}
    >
      {/* Card header — always visible */}
      <button
        className="flex w-full items-start gap-3 p-4 text-left"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_STYLES[log.severity]}`}
            >
              {SEVERITY_LABELS[log.severity]}
            </span>
            {log.resolved && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Rozwiązany
              </Badge>
            )}
            <RelativeTime
              date={log.occurred_at}
              addSuffix
              className="text-sm font-medium"
            />
            <span className="hidden text-xs text-muted-foreground sm:inline" title={absoluteTime}>
              {absoluteTime}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {log.action_name && (
              <span className="font-mono">{log.action_name}()</span>
            )}
            {log.route && <span>{log.route}</span>}
            {log.user_email && (
              <span className="text-foreground/70">{log.user_email}</span>
            )}
          </div>
          <p className="mt-1 truncate text-sm">{log.message}</p>
        </div>
        <span className="mt-1 shrink-0 text-muted-foreground text-sm">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          {log.message && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                Komunikat
              </p>
              <p className="text-sm">{log.message}</p>
            </div>
          )}

          {log.stack && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                Stack trace
              </p>
              <pre className="max-h-72 overflow-auto rounded bg-muted p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
                {log.stack}
              </pre>
            </div>
          )}

          {log.context && Object.keys(log.context).length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                Kontekst
              </p>
              <pre className="rounded bg-muted p-3 font-mono text-xs whitespace-pre-wrap break-words">
                {JSON.stringify(log.context, null, 2)}
              </pre>
            </div>
          )}

          {log.user_agent && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                User Agent
              </p>
              <p className="break-all text-xs text-muted-foreground">{log.user_agent}</p>
            </div>
          )}

          {log.resolved && log.resolved_note && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                Notatka rozwiązania
              </p>
              <p className="text-sm">{log.resolved_note}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            {!log.resolved ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setResolveOpen(true)}
                disabled={isPending}
              >
                Oznacz jako naprawione
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleUnresolve}
                disabled={isPending}
              >
                Cofnij rozwiązanie
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Resolve dialog */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Oznaczyć jako rozwiązany?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="resolve-note">Notatka (opcjonalnie)</Label>
            <Textarea
              id="resolve-note"
              placeholder="Co zostało naprawione..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResolveOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleResolve} disabled={isPending}>
              Oznacz jako naprawione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
