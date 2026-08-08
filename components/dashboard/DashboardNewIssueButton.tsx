"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  IssueForm,
  type IssueFloorOption,
  type IssueApartmentOption,
} from "@/components/issues/IssueForm"

export function DashboardNewIssueButton({
  floors,
  apartments,
}: {
  floors: IssueFloorOption[]
  apartments: IssueApartmentOption[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <PlusIcon className="size-4" />
        Usterka
      </Button>

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
