"use client"

import { useState } from "react"
import { LocationNode } from "./LocationNode"
import { LocationDialog, type DialogMode } from "./LocationDialog"

export type LocationRow = {
  id: string
  parent_id: string | null
  floor_id: string
  name: string
  type: "branch" | "tenant_changes" | "apartment" | "room" | "folder"
  sort_order: number
}

export type LocationTreeNode = LocationRow & {
  children: LocationTreeNode[]
}

function buildTree(
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
}

export function LocationTree({ locations, projectId, floorLevel }: Props) {
  // Default: tenant_changes expanded, branches collapsed
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const loc of locations) {
      if (loc.type === "tenant_changes") initial.add(loc.id)
    }
    return initial
  })

  const [activeDialog, setActiveDialog] = useState<DialogMode | null>(null)

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
        projectId={projectId}
        floorLevel={floorLevel}
      >
        {node.children.map((child) => renderNode(child, depth + 1))}
      </LocationNode>
    )
  }

  return (
    <>
      {roots.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak lokalizacji.</p>
      ) : (
        <ul className="space-y-0.5">
          {roots.map((root) => renderNode(root, 0))}
        </ul>
      )}

      {activeDialog && (
        <LocationDialog
          key={`${activeDialog.type}-${"locationId" in activeDialog ? activeDialog.locationId : activeDialog.parentId}`}
          mode={activeDialog}
          onClose={() => setActiveDialog(null)}
        />
      )}
    </>
  )
}
