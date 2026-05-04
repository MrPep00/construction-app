"use client"

import { Tabs, type TabItem } from "@/components/ui/tabs"

const FLOOR_TABS: TabItem[] = [
  { value: "tasks", label: "Zadania" },
  { value: "notes", label: "Notatki" },
  { value: "inventory", label: "Inwentaryzacja" },
]

interface Props {
  tasks: React.ReactNode
  notes: React.ReactNode
  inventory: React.ReactNode
}

export function FloorTabs({ tasks, notes, inventory }: Props) {
  return (
    <Tabs defaultValue="tasks" tabs={FLOOR_TABS}>
      {[tasks, notes, inventory]}
    </Tabs>
  )
}
