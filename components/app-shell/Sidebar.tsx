"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  PanelLeftCloseIcon,
  PanelLeftIcon,
  ArrowLeftRightIcon,
  UsersIcon,
  ScrollTextIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { SidebarNav } from "./SidebarNav"
import { ThemeToggle } from "./ThemeToggle"
import { SignOutButton } from "@/components/sign-out-button"

const COLLAPSED_KEY = "sidebar:collapsed"

interface Props {
  projectId: string
  projectName: string
  openIssueCount: number
  isAdminUser: boolean
  unresolvedErrorCount: number
  userEmail: string
}

export function Sidebar({
  projectId,
  projectName,
  openIssueCount,
  isAdminUser,
  unresolvedErrorCount,
  userEmail,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1")
  }, [])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSED_KEY, prev ? "0" : "1")
      return !prev
    })
  }

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Header: project name + collapse toggle */}
      <div
        className={cn(
          "flex min-h-14 items-center gap-2 px-3",
          collapsed && "justify-center px-0"
        )}
      >
        {!collapsed && (
          <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={projectName}>
            {projectName}
          </span>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="tap-target flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={collapsed ? "Rozwiń panel boczny" : "Zwiń panel boczny"}
        >
          {collapsed ? <PanelLeftIcon className="size-5" /> : <PanelLeftCloseIcon className="size-5" />}
        </button>
      </div>

      <SidebarNav projectId={projectId} openIssueCount={openIssueCount} collapsed={collapsed} />

      {/* Bottom section */}
      <div className="mt-auto flex flex-col gap-1 border-t border-sidebar-border p-2">
        <Link
          href="/projects"
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            collapsed && "justify-center px-0"
          )}
          title="Zmień projekt"
        >
          <ArrowLeftRightIcon className="size-5 shrink-0" />
          {!collapsed && <span className="truncate">Zmień projekt</span>}
        </Link>

        {isAdminUser && (
          <>
            <Link
              href="/team"
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                collapsed && "justify-center px-0"
              )}
              title="Zespół"
            >
              <UsersIcon className="size-5 shrink-0" />
              {!collapsed && <span className="truncate">Zespół</span>}
            </Link>
            <Link
              href="/admin/errors"
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                collapsed && "justify-center px-0"
              )}
              title="Logi błędów"
            >
              <span className="relative shrink-0">
                <ScrollTextIcon className="size-5" />
                {collapsed && unresolvedErrorCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-destructive" />
                )}
              </span>
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate">Logi błędów</span>
                  {unresolvedErrorCount > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-white">
                      {unresolvedErrorCount}
                    </span>
                  )}
                </>
              )}
            </Link>
          </>
        )}

        <div className={cn("px-1 py-1", collapsed && "px-0")}>
          <ThemeToggle collapsed={collapsed} />
        </div>

        <div
          className={cn(
            "flex items-center gap-2 border-t border-sidebar-border pt-2",
            collapsed && "flex-col"
          )}
        >
          {!collapsed && (
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={userEmail}>
              {userEmail}
            </span>
          )}
          <SignOutButton />
        </div>
      </div>
    </aside>
  )
}
