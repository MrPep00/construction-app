"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { createItem } from "@/lib/actions/inventory"

interface Props {
  projectId: string
}

export function FirstItemPrompt({ projectId }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (dismissed) return null

  function handleAddSuggested() {
    startTransition(async () => {
      const result = await createItem({
        projectId,
        name: "Bloczek silikatowy 24cm",
        unit: "szt",
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Bloczek silikatowy 24cm dodany")
        setDismissed(true)
      }
    })
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800/50 dark:bg-blue-950/30">
      <p className="mb-1 text-sm font-medium">Dodać pierwszą pozycję?</p>
      <p className="mb-3 text-xs text-muted-foreground">
        Sugerujemy: <strong>Bloczek silikatowy 24cm</strong> (szt)
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleAddSuggested} disabled={isPending}>
          {isPending ? "Dodawanie..." : "Tak, dodaj"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
          Pomiń
        </Button>
      </div>
    </div>
  )
}
