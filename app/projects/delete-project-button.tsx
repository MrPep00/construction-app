"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { deleteProject } from "@/lib/actions/projects"

export function DeleteProjectButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteProject(id)
      if (!result?.error) {
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(newOpen) => setOpen(newOpen)}>
      <DialogTrigger
        render={
          <Button variant="destructive" size="icon-sm" aria-label="Usuń projekt" />
        }
      >
        <Trash2 />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Usuń projekt</DialogTitle>
          <DialogDescription>
            Czy na pewno chcesz usunąć projekt &bdquo;{name}&rdquo;? Ta
            operacja jest nieodwracalna i usunie wszystkie dane projektu.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Anuluj</DialogClose>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? "Usuwanie..." : "Usuń projekt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
