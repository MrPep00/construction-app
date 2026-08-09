"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export type PhotoAction = "keep" | "delete"

/** Polish plural for zdjęcie: 1 zdjęcie / 2–4 zdjęcia / 5+ zdjęć. */
function photoNoun(n: number): string {
  if (n === 1) return "zdjęcie"
  const dec = n % 10
  const hun = n % 100
  if (dec >= 2 && dec <= 4 && (hun < 12 || hun > 14)) return "zdjęcia"
  return "zdjęć"
}

interface Props {
  issueTitle: string
  photoCount: number
  /** Same label the issues list shows, e.g. "M31 · P3". */
  locationLabel: string
  onCancel: () => void
  onConfirm: (photoAction: PhotoAction) => void
}

/**
 * Photo-aware issue delete confirm. Default is the non-destructive
 * "Zachowaj" — deleting the photos must be opted into.
 */
export function DeleteIssueDialog({
  issueTitle,
  photoCount,
  locationLabel,
  onCancel,
  onConfirm,
}: Props) {
  const [photoAction, setPhotoAction] = useState<PhotoAction>("keep")

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Usuń usterkę</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Usunąć <strong className="text-foreground">{issueTitle}</strong>? Ta
            usterka ma {photoCount} {photoNoun(photoCount)}.
          </p>

          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Co zrobić ze zdjęciami">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm has-checked:border-brand has-checked:bg-brand-soft">
              <input
                type="radio"
                name="issue-photo-action"
                checked={photoAction === "keep"}
                onChange={() => setPhotoAction("keep")}
              />
              <span>
                Zachowaj w plikach:{" "}
                <span className="font-medium">{locationLabel}</span>
              </span>
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm has-checked:border-destructive has-checked:bg-destructive/10">
              <input
                type="radio"
                name="issue-photo-action"
                checked={photoAction === "delete"}
                onChange={() => setPhotoAction("delete")}
              />
              <span>Usuń zdjęcia razem z usterką</span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Anuluj
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(photoAction)}>
            Usuń usterkę
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
