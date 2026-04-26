"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createProject } from "@/lib/actions/projects"

export function NewProjectForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await createProject(formData)
      if (result?.error) {
        setError(result.error)
      } else if (result?.data) {
        router.push(`/projects/${result.data.id}`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nazwa projektu</Label>
        <Input
          id="name"
          name="name"
          placeholder="Budynek A, ul. Lipowa 12"
          onChange={() => setError(null)}
          required
          maxLength={100}
          autoFocus
          aria-invalid={!!error}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Tworzenie..." : "Utwórz projekt"}
        </Button>
        <Link
          href="/projects"
          className={buttonVariants({ variant: "outline" })}
        >
          Anuluj
        </Link>
      </div>
    </form>
  )
}
