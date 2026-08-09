"use client"

import { useState } from "react"
import { CameraIcon, PlusIcon, TriangleAlertIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  IssueForm,
  type IssueFloorOption,
  type IssueApartmentOption,
} from "@/components/issues/IssueForm"
import { FilesUploadPanel } from "@/components/files/FilesUploadPanel"

interface Props {
  projectId: string
  floors: IssueFloorOption[]
  apartments: IssueApartmentOption[]
}

/**
 * Mobile quick-capture FAB. Tap opens a two-way choice: "Zdjęcie" (file
 * upload with category + target picker, camera capture inside) or
 * "Usterka" (new-issue dialog with floor→apartment picker).
 */
export function Fab({ projectId, floors, apartments }: Props) {
  const [choiceOpen, setChoiceOpen] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setChoiceOpen((v) => !v)}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-brand text-on-brand shadow-lg transition-colors hover:bg-brand-strong lg:hidden"
        aria-label="Dodaj zdjęcie lub usterkę"
        aria-expanded={choiceOpen}
      >
        <PlusIcon className="size-6" />
      </button>

      {choiceOpen && (
        <>
          {/* Backdrop mirrors DialogOverlay styling (plain element — no compound parts) */}
          <button
            type="button"
            onClick={() => setChoiceOpen(false)}
            className="fixed inset-0 z-40 bg-black/10 supports-backdrop-filter:backdrop-blur-xs lg:hidden"
            aria-label="Zamknij"
          />
          <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom)+4rem)] right-4 z-50 flex w-48 flex-col gap-1 rounded-xl bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-foreground/10 lg:hidden">
            <button
              type="button"
              onClick={() => {
                setChoiceOpen(false)
                setPhotoOpen(true)
              }}
              className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-muted"
            >
              <CameraIcon className="size-5 text-muted-foreground" />
              Zdjęcie
            </button>
            <button
              type="button"
              onClick={() => {
                setChoiceOpen(false)
                setIssueOpen(true)
              }}
              className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-muted"
            >
              <TriangleAlertIcon className="size-5 text-muted-foreground" />
              Usterka
            </button>
          </div>
        </>
      )}

      {issueOpen && (
        <IssueForm
          mode="create"
          floors={floors}
          apartments={apartments}
          onClose={() => setIssueOpen(false)}
        />
      )}

      {photoOpen && (
        <Dialog open onOpenChange={(open) => { if (!open) setPhotoOpen(false) }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Dodaj zdjęcie</DialogTitle>
            </DialogHeader>
            <FilesUploadPanel
              projectId={projectId}
              floors={floors}
              apartments={apartments}
              className="mb-0 border-0 p-0"
              uploaderDefaultOpen
              onUploaded={() => setPhotoOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
