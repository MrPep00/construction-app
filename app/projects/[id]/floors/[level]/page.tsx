import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/auth/admin-check"
import { resolveFileUrls } from "@/lib/storage"
import { ZoneActions } from "@/components/floors/ZoneActions"
import { AddUnitButton } from "@/components/lokale/AddUnitButton"
import { LocationTabs } from "@/components/tree/LocationTabs"
import { TaskList } from "@/components/tasks/TaskList"
import { NotesPanel } from "@/components/notes/NotesPanel"
import { FloorTabs } from "@/components/FloorTabs"
import { FloorFilePanel } from "@/components/upload/FloorFilePanel"
import { FloorInventorySummary } from "@/components/inventory/FloorInventorySummary"
import { FloorInventoryPanel } from "@/components/inventory/FloorInventoryPanel"
import type { FileItem } from "@/components/upload/FileGridClient"

export default async function FloorPage({
  params,
}: {
  params: Promise<{ id: string; level: string }>
}) {
  const { id, level: levelStr } = await params
  const level = parseInt(levelStr, 10)

  // No range check: zones use reserved negative levels (-100, -101, ...);
  // unknown levels 404 via the floor lookup below
  if (isNaN(level)) return notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .single()

  if (!project) return notFound()

  const { data: floor } = await supabase
    .from("floors")
    .select("id, level, label, kind")
    .eq("project_id", id)
    .eq("level", level)
    .single()

  if (!floor) return notFound()

  const { data: locations } = await supabase
    .from("locations")
    .select("id, parent_id, floor_id, name, type, sort_order, matrix_label, unit_category")
    .eq("floor_id", floor.id)
    .order("sort_order")

  const locationIds = locations?.map((l) => l.id) ?? []

  // Units already on this floor — feeds the "Dodaj lokal" suggestions and
  // its uniqueness warning. The button needs the seeded root folder to file
  // the unit under, so zones (flat containers) never show it.
  const existingUnits = (locations ?? [])
    .filter((l) => l.type === "apartment")
    .map((l) => ({ id: l.id, name: l.name, matrixLabel: l.matrix_label }))
  const hasUnitFolder = (locations ?? []).some(
    (l) =>
      l.parent_id === null &&
      l.type === "folder" &&
      (l.name === "Lokale" || l.name === "Mieszkania")
  )
  const openIssueCounts: Record<string, number> = {}

  if (locationIds.length > 0) {
    const { data: openIssues } = await supabase
      .from("issues")
      .select("location_id")
      .eq("status", "open")
      .in("location_id", locationIds)

    openIssues?.forEach((issue) => {
      openIssueCounts[issue.location_id] =
        (openIssueCounts[issue.location_id] ?? 0) + 1
    })
  }

  // Floor-level files (drawings)
  const { data: filesData } = await supabase
    .from("files")
    .select("id, name, mime_type, size_bytes, created_at, storage_path, storage_provider")
    .eq("floor_id", floor.id)
    .order("created_at", { ascending: false })

  let floorFileItems: FileItem[] = []
  if (filesData && filesData.length > 0) {
    const urlMap = await resolveFileUrls(
      filesData.map((f) => ({
        storage_path: f.storage_path,
        storage_provider: (f.storage_provider ?? "supabase") as "supabase" | "r2",
      })),
      supabase
    )
    floorFileItems = filesData.map((f) => ({
      ...f,
      storage_provider: f.storage_provider ?? "supabase",
      signedUrl: urlMap.get(f.storage_path) ?? null,
    }))
  }

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
        <span className="text-foreground">{floor.label}</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">{floor.label}</h1>
        {floor.kind === "zone" && isAdmin(user?.email) && (
          <ZoneActions floorId={floor.id} projectId={id} label={floor.label} />
        )}
        {floor.kind !== "zone" && hasUnitFolder && (
          <AddUnitButton
            floorId={floor.id}
            existingUnits={existingUnits}
          />
        )}
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        {/* LEFT — folders + tasks/notes/inventory */}
        <div className="space-y-8">
          <section>
            <LocationTabs
              locations={locations ?? []}
              projectId={id}
              floorLevel={level}
              floorId={floor.id}
              openIssueCounts={openIssueCounts}
            />
          </section>

          <FloorInventorySummary projectId={id} floorId={floor.id} />

          <FloorTabs
            tasks={<TaskList projectId={id} floorId={floor.id} />}
            notes={<NotesPanel projectId={id} floorId={floor.id} />}
            inventory={<FloorInventoryPanel projectId={id} floorId={floor.id} />}
          />
        </div>

        {/* RIGHT — sticky files panel */}
        <aside className="order-first mb-8 lg:order-last lg:mb-0">
          <FloorFilePanel floorId={floor.id} files={floorFileItems} />
        </aside>
      </div>
    </main>
  )
}
