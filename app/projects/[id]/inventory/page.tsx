import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { sortFloorsForDisplay } from "@/lib/floors"
import { InventoryItemTable } from "@/components/inventory/InventoryItemTable"
import { InventoryPageControls } from "@/components/inventory/InventoryPageControls"
import { FirstItemPrompt } from "@/components/inventory/FirstItemPrompt"

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .single()

  if (!project) return notFound()

  const [{ data: floorsData }, { data: itemsData }] = await Promise.all([
    supabase
      .from("floors")
      .select("id, label, kind, sort_order")
      .eq("project_id", id),
    supabase
      .from("inventory_items")
      .select("id, name, unit, pallet_qty")
      .eq("project_id", id),
  ])

  // Same visual order as before 023: bottom floor first, zones last
  const floors = sortFloorsForDisplay(floorsData ?? [], "bottomFirst").map(
    (f) => ({ id: f.id, label: f.label })
  )
  const items = itemsData ?? []

  return (
    <main className="px-4 py-6 md:px-6 lg:px-10">
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground">
          Projekty
        </Link>
        <span>/</span>
        <Link href={`/projects/${id}`} className="hover:text-foreground">
          {project.name}
        </Link>
        <span>/</span>
        <span className="text-foreground">Inwentaryzacja</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Inwentaryzacja</h1>
        <InventoryPageControls projectId={id} items={items} floors={floors} />
      </div>

      {items.length === 0 && (
        <div className="mb-6">
          <FirstItemPrompt projectId={id} />
        </div>
      )}

      <InventoryItemTable projectId={id} />
    </main>
  )
}
