"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboardIcon,
  CircleAlertIcon,
  ClipboardListIcon,
  FolderIcon,
  StickyNoteIcon,
  PackageIcon,
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
  collapsed: boolean
}

export function SidebarNav({ projectId, openIssueCount, collapsed }: Props) {
  const pathname = usePathname()
  const base = `/projects/${projectId}`

  const items: NavItem[] = [
    { label: "Pulpit", href: base, icon: LayoutDashboardIcon },
    { label: "Usterki", href: `${base}/issues`, icon: CircleAlertIcon, badge: openIssueCount },
    { label: "Zadania", icon: ClipboardListIcon, disabled: true },
    { label: "Pliki", icon: FolderIcon, disabled: true },
    { label: "Notatki", href: `${base}/notes`, icon: StickyNoteIcon },
    { label: "Inwentarz", href: `${base}/inventory`, icon: PackageIcon },
  ]

  function isActive(item: NavItem) {
    if (!item.href) return false
    if (item.href === base) {
      return pathname === base || pathname.startsWith(`${base}/floors`)
    }
    return pathname.startsWith(item.href)
  }

  return (
    <nav className="flex flex-col gap-1 px-2">
      {items.map((item) => {
        const active = isActive(item)
        const Icon = item.icon
        const showBadge = (item.badge ?? 0) > 0

        const inner = (
          <>
            <span className="relative shrink-0">
              <Icon className="size-5" />
              {collapsed && showBadge && (
                <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-status-open" />
              )}
            </span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
                {showBadge && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-status-open-bg px-1.5 text-[11px] font-semibold text-status-open">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </>
        )

        const itemClass = cn(
          "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 transition-colors",
          collapsed && "justify-center px-0",
          active
            ? "bg-brand-soft font-medium text-brand"
            : item.disabled
              ? "cursor-not-allowed text-muted-foreground/50"
              : "text-foreground hover:bg-muted"
        )

        if (item.disabled || !item.href) {
          return (
            <span key={item.label} className={itemClass} title="Wkrótce" aria-disabled>
              {inner}
            </span>
          )
        }

        return (
          <Link
            key={item.label}
            href={item.href}
            className={itemClass}
            title={collapsed ? item.label : undefined}
          >
            {inner}
          </Link>
        )
      })}
    </nav>
  )
}
