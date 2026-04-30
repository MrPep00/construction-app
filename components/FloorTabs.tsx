"use client"

import { Tabs, type TabItem } from "@/components/ui/tabs"

const FLOOR_TABS: TabItem[] = [
  { value: "tasks", label: "Zadania" },
  { value: "notes", label: "Notatki" },
]

interface Props {
  tasks: React.ReactNode
  notes: React.ReactNode
}

export function FloorTabs({ tasks, notes }: Props) {
  return (
    <Tabs defaultValue="tasks" tabs={FLOOR_TABS}>
      {[tasks, notes]}
    </Tabs>
  )
}
