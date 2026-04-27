"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface TabItem {
  value: string
  label: string
}

interface TabsRootProps {
  defaultValue: string
  tabs: TabItem[]
  children: ReactNode[]
  className?: string
}

function Tabs({ defaultValue, tabs, children, className }: TabsRootProps) {
  const [active, setActive] = useState(defaultValue)
  const idx = tabs.findIndex((t) => t.value === active)
  const panel = children[idx >= 0 ? idx : 0]

  return (
    <div className={className}>
      <div
        role="tablist"
        className="flex items-center gap-1 rounded-lg bg-muted p-1"
      >
        {tabs.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={active === tab.value}
            onClick={() => setActive(tab.value)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active === tab.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-4">
        {panel}
      </div>
    </div>
  )
}

export { Tabs }
export type { TabItem }
