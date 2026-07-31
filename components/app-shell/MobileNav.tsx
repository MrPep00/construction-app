"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2Icon,
  CircleAlertIcon,
  ClipboardListIcon,
  FolderIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

type NavItem = {
  label: string
  icon: LucideIcon
  href?: string
  disabled?: boolean
  badge?: number
}

interface Props {
  projectId: string
  openIssueCount: number
}

export function MobileNav({ projectId, openIssueCount }: Props) {
  const pathname = usePathname()
  const base = `/projects/${projectId}`

  const items: NavItem[] = [
    { label: "Budynek", href: base, icon: Building2Icon },
    { label: "Usterki", href: `${base}/issues`, icon: CircleAlertIcon, badge: openIssueCount },
    { label: "Zadania", icon: ClipboardListIcon, disabled: true },
    { label: "Pliki", icon: FolderIcon, disabled: true },
  ]

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Nawigacja dolna"
    >
      <div className="grid grid-cols-4">
        {items.map((item) => {
          const active = item.href
            ? item.href === base
              ? pathname === base || pathname.startsWith(`${base}/floors`)
              : pathname.startsWith(item.href)
            : false
          const Icon = item.icon
          const showBadge = (item.badge ?? 0) > 0

          const inner = (
            <>
              <span className="relative">
                <Icon className="size-5" />
                {showBadge && (
                  <span className="absolute -right-2 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-status-open-bg px-1 text-[10px] font-semibold text-status-open">
                    {item.badge}
                  </span>
                )}
              </span>
              <span className="text-[11px] leading-tight">{item.label}</span>
            </>
          )

          const itemClass = cn(
            "flex min-h-14 flex-col items-center justify-center gap-0.5",
            active
              ? "text-brand"
              : item.disabled
                ? "text-muted-foreground/50"
                : "text-muted-foreground"
          )

          if (item.disabled || !item.href) {
            return (
              <span key={item.label} className={itemClass} title="Wkrótce" aria-disabled>
                {inner}
              </span>
            )
          }

          return (
            <Link key={item.label} href={item.href} className={itemClass}>
              {inner}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
