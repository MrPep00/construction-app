"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { SunIcon, MoonIcon, MonitorIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const OPTIONS = [
  { value: "light", label: "Jasny", icon: SunIcon },
  { value: "dark", label: "Ciemny", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const

interface Props {
  collapsed?: boolean
  /** "compact" = icon-only segments (fits a narrow rail), "labeled" = icon + text. */
  variant?: "compact" | "labeled"
}

export function ThemeToggle({ collapsed = false, variant = "labeled" }: Props) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // Avoid hydration mismatch: render a neutral placeholder until mounted
  if (!mounted) {
    return <div className={cn("h-11", collapsed ? "w-11" : "w-full")} />
  }

  if (collapsed) {
    const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[2]
    const next = OPTIONS[(OPTIONS.indexOf(current) + 1) % OPTIONS.length]
    const Icon = current.icon
    return (
      <button
        type="button"
        onClick={() => setTheme(next.value)}
        className="tap-target flex min-h-11 w-full items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title={`Motyw: ${current.label} (kliknij: ${next.label})`}
        aria-label={`Motyw: ${current.label}`}
      >
        <Icon className="size-5" />
      </button>
    )
  }

  const compact = variant === "compact"

  return (
    <div className="flex rounded-lg border border-border-soft p-0.5" role="radiogroup" aria-label="Motyw">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => setTheme(value)}
          className={cn(
            "tap-target flex flex-1 items-center justify-center rounded-md transition-colors",
            compact ? "min-h-10 min-w-10" : "min-h-10 gap-1.5 px-2 text-xs",
            theme === value
              ? "bg-brand-soft font-medium text-brand"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          title={label}
          aria-label={label}
        >
          <Icon className={compact ? "size-5" : "size-4"} />
          {!compact && <span className="sr-only xl:not-sr-only">{label}</span>}
        </button>
      ))}
    </div>
  )
}
