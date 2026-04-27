"use client"

import Link from "next/link"
import { ChevronRightIcon, MoreHorizontalIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { LocationTreeNode } from "./LocationTree"
import type { DialogMode } from "./LocationDialog"

export const TYPE_ICONS: Record<string, string> = {
  branch: "📐",
  tenant_changes: "🏠",
  apartment: "🚪",
  room: "🛋️",
  folder: "📁",
}

const CAN_ADD_SUBFOLDER = new Set(["branch", "tenant_changes", "folder", "apartment", "room"])
const CAN_ADD_APARTMENT = new Set(["branch", "tenant_changes"])

interface Props {
  node: LocationTreeNode
  depth: number
  expanded: boolean
  onToggle: () => void
  onDialog: (mode: DialogMode) => void
  projectId: string
  floorLevel: number
  openIssueCount?: number
  children?: React.ReactNode
}

export function LocationNode({
  node,
  depth,
  expanded,
  onToggle,
  onDialog,
  projectId,
  floorLevel,
  openIssueCount = 0,
  children,
}: Props) {
  const isLocked =
    node.parent_id === null &&
    (node.type === "branch" || node.type === "tenant_changes")

  const hasChildren = node.children.length > 0
  // md:24px, default 16px per depth level
  const indentStyle = {
    paddingLeft: `${depth * 16 + 4}px`,
  }

  return (
    <li>
      <div
        className="group flex min-h-[44px] items-center gap-1 rounded-lg pr-1 hover:bg-muted/50 md:min-h-0 md:py-1"
        style={indentStyle}
      >
        {/* Expand/collapse chevron — always takes up space for alignment */}
        <button
          type="button"
          onClick={hasChildren ? onToggle : undefined}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors",
            hasChildren
              ? "hover:bg-muted hover:text-foreground"
              : "invisible pointer-events-none"
          )}
          aria-label={expanded ? "Zwiń" : "Rozwiń"}
          tabIndex={hasChildren ? 0 : -1}
        >
          <ChevronRightIcon
            className={cn(
              "size-4 transition-transform duration-150",
              expanded && "rotate-90"
            )}
          />
        </button>

        {/* Icon */}
        <span className="shrink-0 text-base leading-none select-none">
          {TYPE_ICONS[node.type] ?? "📁"}
        </span>

        {/* Name link */}
        <Link
          href={`/projects/${projectId}/floors/${floorLevel}/${node.id}`}
          className="flex min-w-0 flex-1 items-center gap-1.5 truncate py-2 text-sm font-medium hover:text-primary md:py-0"
        >
          <span className="truncate">{node.name}</span>
          {openIssueCount > 0 && (
            <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {openIssueCount}
            </span>
          )}
        </Link>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-sm" }),
              "shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            )}
            aria-label="Opcje"
          >
            <MoreHorizontalIcon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end">
            {CAN_ADD_SUBFOLDER.has(node.type) && (
              <DropdownMenuItem
                onClick={() =>
                  onDialog({
                    type: "create-subfolder",
                    parentId: node.id,
                    floorId: node.floor_id,
                  })
                }
              >
                Dodaj podfolder
              </DropdownMenuItem>
            )}
            {CAN_ADD_APARTMENT.has(node.type) && (
              <DropdownMenuItem
                onClick={() =>
                  onDialog({
                    type: "create-apartment",
                    parentId: node.id,
                    floorId: node.floor_id,
                  })
                }
              >
                Dodaj mieszkanie
              </DropdownMenuItem>
            )}

            {!isLocked &&
              (CAN_ADD_SUBFOLDER.has(node.type) ||
                CAN_ADD_APARTMENT.has(node.type)) && (
                <DropdownMenuSeparator />
              )}

            {!isLocked && (
              <DropdownMenuItem
                onClick={() =>
                  onDialog({
                    type: "rename",
                    locationId: node.id,
                    currentName: node.name,
                  })
                }
              >
                Zmień nazwę
              </DropdownMenuItem>
            )}
            {!isLocked && (
              <DropdownMenuItem
                variant="destructive"
                onClick={() =>
                  onDialog({
                    type: "delete",
                    locationId: node.id,
                    name: node.name,
                  })
                }
              >
                Usuń
              </DropdownMenuItem>
            )}
            {isLocked && (
              <DropdownMenuItem disabled>
                Domyślna lokalizacja
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Rendered children injected by LocationTree */}
      {hasChildren && expanded && children && (
        <ul>{children}</ul>
      )}
    </li>
  )
}
