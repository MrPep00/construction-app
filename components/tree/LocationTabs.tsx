"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { LocationNode } from "./LocationNode"
import { LocationDialog, type DialogMode } from "./LocationDialog"
import { buildTree, type LocationRow, type LocationTreeNode } from "./LocationTree"
import { FileUploader } from "@/components/upload/FileUploader"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const TYPE_ICONS: Record<string, string> = {
  tenant_changes: "🏠",
  apartment: "🚪",
  folder: "📁",
  room: "🔲",
}

interface Props {
  locations: LocationRow[]
  projectId: string
  floorLevel: number
  floorId: string
  openIssueCounts?: Record<string, number>
}

export function LocationTabs({
  locations,
  projectId,
  floorLevel,
  floorId,
  openIssueCounts,
}: Props) {
  const roots = buildTree(locations)

  const [activeTabId, setActiveTabId] = useState<string | null>(
    () => roots[0]?.id ?? null
  )
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const loc of locations) {
      if (loc.type === "tenant_changes") initial.add(loc.id)
    }
    return initial
  })
  const [activeDialog, setActiveDialog] = useState<DialogMode | null>(null)
  const [uploaderNode, setUploaderNode] = useState<{
    id: string
    name: string
  } | null>(null)

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function renderNode(node: LocationTreeNode, depth: number): React.ReactNode {
    const expanded = expandedIds.has(node.id)
    return (
      <LocationNode
        key={node.id}
        node={node}
        depth={depth}
        expanded={expanded}
        onToggle={() => toggleExpanded(node.id)}
        onDialog={setActiveDialog}
        onOpenUploader={(id, name) => setUploaderNode({ id, name })}
        projectId={projectId}
        floorLevel={floorLevel}
        openIssueCount={openIssueCounts?.[node.id] ?? 0}
      >
        {node.children.map((child) => renderNode(child, depth + 1))}
      </LocationNode>
    )
  }

  const activeRoot = roots.find((r) => r.id === activeTabId) ?? null

  return (
    <>
      {/* Chrome-style tab bar */}
      <div className="flex items-end overflow-x-auto border-b border-border [&::-webkit-scrollbar]:hidden">
        {roots.map((root) => (
          <button
            key={root.id}
            role="tab"
            aria-selected={activeTabId === root.id}
            onClick={() => setActiveTabId(root.id)}
            className={cn(
              "relative -mb-px flex h-9 shrink-0 select-none items-center gap-1.5 rounded-t-lg border border-b-0 px-3 text-sm font-medium transition-colors",
              activeTabId === root.id
                ? "border-border bg-background text-foreground [box-shadow:0_1px_0_0_hsl(var(--background))]"
                : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <span className="text-xs leading-none">
              {TYPE_ICONS[root.type] ?? "📁"}
            </span>
            <span className="max-w-[140px] truncate">{root.name}</span>
          </button>
        ))}

        {/* Add root folder */}
        <button
          type="button"
          onClick={() =>
            setActiveDialog({ type: "create-subfolder", parentId: null, floorId })
          }
          className="ml-1 flex h-9 shrink-0 items-center gap-1 rounded-t-lg px-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Dodaj folder"
          title="Dodaj folder"
        >
          <PlusIcon className="size-4" />
        </button>
      </div>

      {/* Tab panel content */}
      <div className="rounded-b-lg border border-t-0 border-border bg-background p-3">
        {roots.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Brak folderów</p>
        ) : activeRoot ? (
          <>
            {activeRoot.children.length > 0 ? (
              <ul className="space-y-0.5">
                {activeRoot.children.map((child) => renderNode(child, 0))}
              </ul>
            ) : (
              <p className="py-2 text-sm text-muted-foreground">
                Brak podfolderów
              </p>
            )}

            <button
              type="button"
              onClick={() =>
                setActiveDialog({
                  type: "create-subfolder",
                  parentId: activeRoot.id,
                  floorId,
                })
              }
              className="mt-2 flex min-h-[44px] w-full items-center gap-2 rounded-lg border border-dashed border-input px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground md:min-h-0 md:py-2"
            >
              <PlusIcon className="size-4 shrink-0" />
              Dodaj podfolder
            </button>
          </>
        ) : null}
      </div>

      {activeDialog && (
        <LocationDialog
          key={`${activeDialog.type}-${"locationId" in activeDialog ? activeDialog.locationId : activeDialog.parentId}`}
          mode={activeDialog}
          onClose={() => setActiveDialog(null)}
        />
      )}

      {uploaderNode && (
        <Dialog
          open
          onOpenChange={(o) => {
            if (!o) setUploaderNode(null)
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Wgraj plik — {uploaderNode.name}</DialogTitle>
            </DialogHeader>
            <FileUploader
              locationId={uploaderNode.id}
              defaultOpen
              onDone={() => setUploaderNode(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
