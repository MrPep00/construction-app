"use client"

import type { ReactNode } from "react"
import { Tabs, type TabItem } from "@/components/ui/tabs"

const INVENTORY_TABS: TabItem[] = [
  { value: "stock", label: "Stan magazynowy" },
  { value: "log", label: "Historia ruchów" },
]

interface Props {
  stock: ReactNode
  log: ReactNode
}

export function InventoryTabs({ stock, log }: Props) {
  return (
    <Tabs defaultValue="stock" tabs={INVENTORY_TABS}>
      {[stock, log]}
    </Tabs>
  )
}
