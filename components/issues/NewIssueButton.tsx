"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IssueForm } from "./IssueForm"

interface Props {
  locationId: string
}

export function NewIssueButton({ locationId }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon />
        Nowa usterka
      </Button>

      {open && (
        <IssueForm
          mode="create"
          locationId={locationId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
