"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"
import { LocationDialog, type DialogMode } from "./LocationDialog"

interface Props {
  mode: DialogMode
  label: string
}

export function AddChildButton({ mode, label }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[44px] items-center gap-2 rounded-lg border border-dashed border-input px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <PlusIcon className="size-4 shrink-0" />
        {label}
      </button>

      {open && (
        <LocationDialog mode={mode} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
