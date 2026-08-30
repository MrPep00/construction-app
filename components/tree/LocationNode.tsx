"use client"

import Link from "next/link"
import {
  ChevronRightIcon,
  FolderPlusIcon,
  MoreHorizontalIcon,
  UploadIcon,
} from "lucide-react"
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
  tenant_changes: "🏠",
  apartment: "🚪",
  room: "🛋️",
  folder: "📁",
}

const CAN_ADD_SUBFOLDER = new Set(["tenant_changes", "folder", "apartment", "room"])
const CAN_ADD_APARTMENT = new Set(["tenant_changes"])

interface Props {
  node: LocationTreeNode
  depth: number
  expanded: boolean
  onToggle: () => void
  onDialog: (mode: DialogMode) => void
  onOpenUploader: (id: string, name: string) => void
  projectId: string
  floorLevel: number
  openIssueCount?: number
  tenantChangesId?: string | null
  children?: React.ReactNode
}

export function LocationNode({
  node,
  depth,
  expanded,
  onToggle,
  onDialog,
  onOpenUploader,
  projectId,
  floorLevel,
  openIssueCount = 0,
  tenantChangesId,
  children,
}: Props) {
  const isLocked = node.parent_id === null && node.type === "tenant_changes"
  const hasChildren = node.children.length > 0
  const indentStyle = { paddingLeft: `${depth * 16 + 4}px` }

  return (
    <li>
      <div
        className="group flex min-h-[44px] items-center gap-1 rounded-lg pr-1 hover:bg-muted/50 md:min-h-0 md:py-1"
        style={indentStyle}
      >
        {/* Expand/collapse chevron */}
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

        {/* Upload button — always visible */}
        <button
          type="button"
          onClick={() => onOpenUploader(node.id, node.name)}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon-sm" }),
            "shrink-0"
          )}
          aria-label={`Dodaj plik do ${node.name}`}
          title="Dodaj plik"
        >
          <UploadIcon className="size-4" />
        </button>

        {/* Add subfolder button — always visible */}
        {CAN_ADD_SUBFOLDER.has(node.type) && (
          <button
            type="button"
            onClick={() =>
              onDialog({
                type: "create-subfolder",
                parentId: node.id,
                floorId: node.floor_id,
              })
            }
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-sm" }),
              "shrink-0"
            )}
            aria-label={`Dodaj podfolder do ${node.name}`}
            title="Dodaj podfolder"
          >
            <FolderPlusIcon className="size-4" />
          </button>
        )}

        {/* Dropdown for secondary actions (rename, delete, add apartment) */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-sm" }),
              "shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            )}
            aria-label="Więcej opcji"
          >
            <MoreHorizontalIcon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end">
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
                Dodaj lokal
              </DropdownMenuItem>
            )}
            {CAN_ADD_APARTMENT.has(node.type) && !isLocked && (
              <DropdownMenuSeparator />
            )}
            {node.type === "apartment" && tenantChangesId && node.parent_id !== tenantChangesId && (
              <>
                <DropdownMenuItem
                  onClick={() =>
                    onDialog({
                      type: "move-to-tenant-changes",
                      locationId: node.id,
                      name: node.name,
                      tenantChangesId,
                    })
                  }
                >
                  Przenieś do zmian lokatorskich
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
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

      {hasChildren && expanded && children && (
        <ul>{children}</ul>
      )}
    </li>
  )
}
