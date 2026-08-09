"use client"

import { useState } from "react"
import { CameraIcon } from "lucide-react"
import {
  IssueForm,
  type IssueFloorOption,
  type IssueApartmentOption,
} from "@/components/issues/IssueForm"

interface Props {
  floors: IssueFloorOption[]
  apartments: IssueApartmentOption[]
}

/**
 * Camera-first defect capture. Opens the new-issue dialog with the
 * floor→apartment picker on every page it appears (IssueForm's photo
 * input has capture="environment").
 */
export function Fab({ floors, apartments }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-brand text-on-brand shadow-lg transition-colors hover:bg-brand-strong lg:hidden"
        aria-label="Zgłoś usterkę ze zdjęciem"
      >
        <CameraIcon className="size-6" />
      </button>

      {open && (
        <IssueForm
          mode="create"
          floors={floors}
          apartments={apartments}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
