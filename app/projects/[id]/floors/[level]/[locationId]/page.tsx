import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { resolveFileUrls } from "@/lib/storage"
import { TYPE_ICONS } from "@/components/tree/LocationNode"
import { FileUploader } from "@/components/upload/FileUploader"
import { FileGridClient } from "@/components/upload/FileGridClient"
import { LocationSidePanel } from "@/components/location/LocationSidePanel"

export default async function LocationPage({
  params,
}: {
  params: Promise<{ id: string; level: string; locationId: string }>
}) {
  const { id, level: levelStr, locationId } = await params
  const level = parseInt(levelStr, 10)

  if (isNaN(level) || level < -2 || level > 7) return notFound()

  const supabase = await createClient()

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .single()

  if (!project) return notFound()

  const { data: floor } = await supabase
    .from("floors")
    .select("id, level, label")
    .eq("project_id", id)
    .eq("level", level)
    .single()

  if (!floor) return notFound()

  const { data: location } = await supabase
    .from("locations")
    .select("id, name, type, parent_id")
    .eq("id", locationId)
    .eq("floor_id", floor.id)
    .single()

  if (!location) return notFound()

  const [{ data: issuesData }, { data: filesData }, { data: tasksData }] =
    await Promise.all([
      supabase
        .from("issues")
        .select("id, title, description, contractor, status, created_at")
        .eq("location_id", locationId)
        .order("created_at", { ascending: false }),
      supabase
        .from("files")
        .select("id, name, mime_type, size_bytes, created_at, storage_path, storage_provider")
        .eq("location_id", locationId)
        .order("created_at", { ascending: false }),
      supabase
        .from("tasks")
        .select("id, title, description, status, priority, due_date, created_at, updated_at")
        .eq("location_id", locationId)
        .order("created_at", { ascending: false }),
    ])

  let fileItems: import("@/components/upload/FileGridClient").FileItem[] = []
  if (filesData && filesData.length > 0) {
    const urlMap = await resolveFileUrls(
      filesData.map((f) => ({
        storage_path: f.storage_path,
        storage_provider: (f.storage_provider ?? "supabase") as "supabase" | "r2",
      })),
      supabase
    )
    fileItems = filesData.map((f) => ({
      ...f,
      storage_provider: f.storage_provider ?? "supabase",
      signedUrl: urlMap.get(f.storage_path) ?? null,
    }))
  }

  // Build breadcrumb by walking up parent chain
  const breadcrumbParts: { id: string; name: string }[] = []
  let current: { parent_id: string | null; name: string; id: string } = location

  while (current.parent_id) {
    const { data: parent } = await supabase
      .from("locations")
      .select("id, name, parent_id")
      .eq("id", current.parent_id)
      .single()

    if (!parent) break
    breadcrumbParts.unshift({ id: parent.id, name: parent.name })
    current = parent
  }

  const icon = TYPE_ICONS[location.type] ?? "📁"

  return (
    <main className="px-4 py-6 md:px-6 lg:px-10">
      <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground">
          Projekty
        </Link>
        <span>/</span>
        <Link href={`/projects/${id}`} className="hover:text-foreground">
          {project.name}
        </Link>
        <span>/</span>
        <Link
          href={`/projects/${id}/floors/${level}`}
          className="hover:text-foreground"
        >
          {floor.label}
        </Link>
        {breadcrumbParts.map((part) => (
          <span key={part.id} className="flex items-center gap-1.5">
            <span>/</span>
            <Link
              href={`/projects/${id}/floors/${level}/${part.id}`}
              className="hover:text-foreground"
            >
              {part.name}
            </Link>
          </span>
        ))}
        <span>/</span>
        <span className="text-foreground">{location.name}</span>
      </nav>

      <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <span>{icon}</span>
        <span>{location.name}</span>
      </h1>

      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        {/* LEFT — files */}
        <section className="order-first mb-8 lg:mb-0">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Pliki</h2>
          <FileUploader locationId={locationId} />
          {fileItems.length > 0 ? (
            <div className="mt-4">
              <FileGridClient files={fileItems} className="grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3" />
            </div>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">Brak plików</p>
          )}
        </section>

        {/* RIGHT — sticky issues + tasks panel */}
        <aside className="lg:order-last">
          <LocationSidePanel
            issues={issuesData ?? []}
            tasks={(tasksData ?? []).map((t) => ({ ...t, files: [] }))}
            locationId={locationId}
            projectId={id}
            floorId={floor.id}
          />
        </aside>
      </div>
    </main>
  )
}
