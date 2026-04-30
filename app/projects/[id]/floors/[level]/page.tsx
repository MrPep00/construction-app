import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { LocationTree } from "@/components/tree/LocationTree"
import { TaskList } from "@/components/tasks/TaskList"
import { NotesPanel } from "@/components/notes/NotesPanel"
import { FloorTabs } from "@/components/FloorTabs"
import { FileUploader } from "@/components/upload/FileUploader"
import { FileGrid } from "@/components/upload/FileGrid"
import type { FileItem } from "@/components/upload/FileGridClient"

export default async function FloorPage({
  params,
}: {
  params: Promise<{ id: string; level: string }>
}) {
  const { id, level: levelStr } = await params
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

  const { data: locations } = await supabase
    .from("locations")
    .select("id, parent_id, floor_id, name, type, sort_order")
    .eq("floor_id", floor.id)
    .order("sort_order")

  const locationIds = locations?.map((l) => l.id) ?? []
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
    .select("id, name, mime_type, size_bytes, created_at, storage_path")
    .eq("floor_id", floor.id)
    .order("created_at", { ascending: false })

  let floorFileItems: FileItem[] = []
  if (filesData && filesData.length > 0) {
    const paths = filesData.map((f) => f.storage_path)
    const { data: signedUrls } = await supabase.storage
      .from("files")
      .createSignedUrls(paths, 3600)
    const urlMap = new Map<string, string>()
    signedUrls?.forEach(({ path, signedUrl }) => {
      if (path && signedUrl) urlMap.set(path, signedUrl)
    })
    floorFileItems = filesData.map((f) => ({
      ...f,
      signedUrl: urlMap.get(f.storage_path) ?? null,
    }))
  }

  return (
    <main className="container mx-auto max-w-3xl px-4 py-6">
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

      <h1 className="mb-6 text-2xl font-bold">{floor.label}</h1>

      {/* Floor-level files — always visible */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Pliki piętra</h2>
        <FileUploader floorId={floor.id} />
        {floorFileItems.length > 0 && (
          <div className="mt-4">
            <FileGrid files={floorFileItems} />
          </div>
        )}
      </section>

      {/* Subfolders (Zmiany lokatorskie + custom) — always visible */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Foldery</h2>
        <LocationTree
          locations={locations ?? []}
          projectId={id}
          floorLevel={level}
          floorId={floor.id}
          openIssueCounts={openIssueCounts}
        />
      </section>

      {/* Tasks & Notes as tabs */}
      <FloorTabs
        tasks={<TaskList projectId={id} floorId={floor.id} />}
        notes={<NotesPanel projectId={id} floorId={floor.id} />}
      />
    </main>
  )
}
