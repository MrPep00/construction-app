"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"
import { LocationNode } from "./LocationNode"
import { LocationDialog, type DialogMode } from "./LocationDialog"
import { FileUploader } from "@/components/upload/FileUploader"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type LocationRow = {
  id: string
  parent_id: string | null
  floor_id: string
  name: string
  type: "tenant_changes" | "apartment" | "room" | "folder"
  sort_order: number
}

export type LocationTreeNode = LocationRow & {
  children: LocationTreeNode[]
}

export function buildTree(
  rows: LocationRow[],
  parentId: string | null = null
): LocationTreeNode[] {
  return rows
    .filter((r) => r.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "pl"))
    .map((r) => ({ ...r, children: buildTree(rows, r.id) }))
}

interface Props {
  locations: LocationRow[]
  projectId: string
  floorLevel: number
  floorId: string
  openIssueCounts?: Record<string, number>
}

export function LocationTree({ locations, projectId, floorLevel, floorId, openIssueCounts }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const loc of locations) {
      if (loc.type === "tenant_changes") initial.add(loc.id)
    }
    return initial
  })

  const [activeDialog, setActiveDialog] = useState<DialogMode | null>(null)
  const [uploaderNode, setUploaderNode] = useState<{ id: string; name: string } | null>(null)

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const roots = buildTree(locations)
  const tenantChangesId = locations.find((l) => l.type === "tenant_changes")?.id ?? null

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
        tenantChangesId={tenantChangesId}
      >
        {node.children.map((child) => renderNode(child, depth + 1))}
      </LocationNode>
    )
  }

  return (
    <>
      {roots.length > 0 && (
        <ul className="space-y-0.5">
          {roots.map((root) => renderNode(root, 0))}
        </ul>
      )}

      <button
        type="button"
        onClick={() =>
          setActiveDialog({ type: "create-subfolder", parentId: null, floorId })
        }
        className="mt-2 flex min-h-[44px] w-full items-center gap-2 rounded-lg border border-dashed border-input px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground md:min-h-0 md:py-2"
      >
        <PlusIcon className="size-4 shrink-0" />
        Dodaj folder
      </button>

      {activeDialog && (
        <LocationDialog
          key={`${activeDialog.type}-${"locationId" in activeDialog ? activeDialog.locationId : activeDialog.parentId}`}
          mode={activeDialog}
          onClose={() => setActiveDialog(null)}
        />
      )}

      {uploaderNode && (
        <Dialog open onOpenChange={(o) => { if (!o) setUploaderNode(null) }}>
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
