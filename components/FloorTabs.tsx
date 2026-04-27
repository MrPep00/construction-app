"use client"

import { Tabs, type TabItem } from "@/components/ui/tabs"

const FLOOR_TABS: TabItem[] = [
  { value: "tree", label: "Drzewo" },
  { value: "tasks", label: "Zadania" },
  { value: "notes", label: "Notatki" },
]

interface Props {
  tree: React.ReactNode
  tasks: React.ReactNode
  notes: React.ReactNode
}

export function FloorTabs({ tree, tasks, notes }: Props) {
  return (
    <Tabs defaultValue="tree" tabs={FLOOR_TABS}>
      {[tree, tasks, notes]}
    </Tabs>
  )
}
