"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboardIcon,
  CircleAlertIcon,
  ClipboardListIcon,
  FolderIcon,
  StickyNoteIcon,
  PackageIcon,
  MenuIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "./ThemeToggle"

type NavItem = {
  label: string
  icon: LucideIcon
  href: string
  badge?: number
}

interface Props {
  projectId: string
  openIssueCount: number
}

export function MobileNav({ projectId, openIssueCount }: Props) {
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)
  const base = `/projects/${projectId}`

  const items: NavItem[] = [
    { label: "Pulpit", href: base, icon: LayoutDashboardIcon },
    { label: "Usterki", href: `${base}/issues`, icon: CircleAlertIcon, badge: openIssueCount },
    { label: "Pliki", href: `${base}/files`, icon: FolderIcon },
  ]

  const moreItems: NavItem[] = [
    { label: "Zadania", href: `${base}/tasks`, icon: ClipboardListIcon },
    { label: "Notatki", href: `${base}/notes`, icon: StickyNoteIcon },
    { label: "Inwentarz", href: `${base}/inventory`, icon: PackageIcon },
  ]

  useEffect(() => {
    if (!sheetOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSheetOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [sheetOpen])

  function isActive(href: string) {
    return href === base
      ? pathname === base || pathname.startsWith(`${base}/floors`)
      : pathname.startsWith(href)
  }

  const moreActive = moreItems.some((item) => isActive(item.href))

  const itemClass = (active: boolean) =>
    cn(
      "flex min-h-14 flex-col items-center justify-center gap-0.5",
      active ? "text-brand" : "text-muted-foreground"
    )

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Nawigacja dolna"
      >
        <div className="grid grid-cols-4">
          {items.map((item) => {
            const Icon = item.icon
            const showBadge = (item.badge ?? 0) > 0

            return (
              <Link key={item.label} href={item.href} className={itemClass(isActive(item.href))}>
                <span className="relative">
                  <Icon className="size-5" />
                  {showBadge && (
                    <span className="absolute -right-2 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-status-open-bg px-1 text-[10px] font-semibold text-status-open">
                      {item.badge}
                    </span>
                  )}
                </span>
                <span className="text-[11px] leading-tight">{item.label}</span>
              </Link>
            )
          })}

          <button
            type="button"
            onClick={() => setSheetOpen((prev) => !prev)}
            className={itemClass(moreActive || sheetOpen)}
            aria-label="Więcej"
            aria-expanded={sheetOpen}
            aria-haspopup="dialog"
          >
            <MenuIcon className="size-5" />
            <span className="text-[11px] leading-tight">Więcej</span>
          </button>
        </div>
      </nav>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Więcej">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setSheetOpen(false)}
            aria-label="Zamknij"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t bg-background p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-lg">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted-foreground/30" />
            <ul className="flex flex-col">
              {moreItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      onClick={() => setSheetOpen(false)}
                      className={cn(
                        "flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                        active
                          ? "bg-brand-soft font-medium text-brand"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      <Icon className="size-5 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
            <div className="mt-2 border-t pt-3">
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
