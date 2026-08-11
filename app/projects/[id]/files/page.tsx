import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { resolveFileUrls } from "@/lib/storage"
import {
  apartmentAncestorId,
  floorShortLabel,
  type LocationNode,
} from "@/lib/locations"
import { isVisibleCategory, VISIBLE_CATEGORIES, type VisibleCategory } from "@/lib/files/categories"
import {
  ProjectFilesClient,
  type ProjectFileRow,
} from "@/components/files/ProjectFilesClient"
import { FilesUploadPanel } from "@/components/files/FilesUploadPanel"

type FileRecord = {
  id: string
  name: string
  mime_type: string
  size_bytes: number
  created_at: string
  storage_path: string
  storage_provider: "supabase" | "r2"
  category: string
  location_id: string | null
  floor_id: string | null
}

const DEFAULT_LIMIT = 200
const MAX_LIMIT = 2000

export default async function ProjectFilesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ category?: string; limit?: string }>
}) {
  const { id } = await params
  const { category: categoryParam, limit: limitParam } = await searchParams
  const category = isVisibleCategory(categoryParam) ? categoryParam : null
  const limit = Math.min(
    Math.max(Number(limitParam) || DEFAULT_LIMIT, DEFAULT_LIMIT),
    MAX_LIMIT
  )
  const supabase = await createClient()

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .single()
  if (!project) return notFound()

  const { data: floorsData } = await supabase
    .from("floors")
    .select("id, level, label, kind, sort_order")
    .eq("project_id", id)
    .order("sort_order")
  const floors = floorsData ?? []
  const floorIds = floors.map((f) => f.id)
  const floorById = new Map(floors.map((f) => [f.id, f]))

  const { data: locationsData } =
    floorIds.length > 0
      ? await supabase
          .from("locations")
          .select("id, floor_id, parent_id, name, type")
          .in("floor_id", floorIds)
      : { data: [] }
  const locations = locationsData ?? []
  const locationById = new Map<string, LocationNode & { name: string }>(
    locations.map((l) => [l.id, l])
  )

  // Migration 022: files carry project_id directly — covers floor, location,
  // and target-less project-level files in one predicate. Task files are
  // excluded via category (021 contract: single predicate, no task_id checks).

  // "Zdjęcia" is a display-level union: issue photos OR image files not
  // explicitly categorized drawing/protocol (explicit choice wins). Together
  // with the image-less Dokumentacja this partitions all non-task files.
  // Repeated .or() filters AND together.
  const PHOTO_UNION =
    "category.eq.issue_photo,and(mime_type.like.image/*,category.not.in.(drawing,protocol))"

  let filesQuery = supabase
    .from("files")
    .select(
      "id, name, mime_type, size_bytes, created_at, storage_path, storage_provider, category, location_id, floor_id"
    )
    .eq("project_id", id)
    .neq("category", "task_file")
    .order("created_at", { ascending: false })
    .limit(limit + 1)
  if (category === "issue_photo") filesQuery = filesQuery.or(PHOTO_UNION)
  // "Dokumentacja" is the union's complement: its images belong to Zdjęcia
  // exclusively. Drawing/protocol stay verbatim — explicit user choice wins.
  else if (category === "documentation")
    filesQuery = filesQuery.eq("category", category).not("mime_type", "like", "image/*")
  else if (category) filesQuery = filesQuery.eq("category", category)

  const [filesRes, totalRes, ...countResults] = await Promise.all([
    filesQuery,
    // Distinct total for "Wszystkie" — the union overlaps other categories,
    // so summing per-category counts would double-count image files
    supabase
      .from("files")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id)
      .neq("category", "task_file"),
    ...VISIBLE_CATEGORIES.map((cat) =>
      cat === "issue_photo"
        ? supabase
            .from("files")
            .select("id", { count: "exact", head: true })
            .eq("project_id", id)
            .neq("category", "task_file")
            .or(PHOTO_UNION)
        : cat === "documentation"
          ? supabase
              .from("files")
              .select("id", { count: "exact", head: true })
              .eq("project_id", id)
              .eq("category", cat)
              .not("mime_type", "like", "image/*")
          : supabase
              .from("files")
              .select("id", { count: "exact", head: true })
              .eq("project_id", id)
              .eq("category", cat)
    ),
  ])

  const counts = Object.fromEntries(
    VISIBLE_CATEGORIES.map((cat, i) => [cat, countResults[i].count ?? 0])
  ) as Record<VisibleCategory, number>
  const total = totalRes.count ?? 0

  const fetched = (filesRes.data ?? []) as FileRecord[]
  const hasMore = fetched.length > limit
  const files = hasMore ? fetched.slice(0, limit) : fetched

  const urls = await resolveFileUrls(files, supabase)

  const rows: ProjectFileRow[] = files.map((file) => {
    // Target-less rows (022) are project-level — labeled "Projekt" in the Piętro column
    let floorLabel = "Projekt"
    if (file.floor_id) {
      const floor = floorById.get(file.floor_id)
      floorLabel = floor ? floorShortLabel(floor) : "—"
    } else if (file.location_id) {
      const loc = locationById.get(file.location_id)
      const floor = loc ? floorById.get(loc.floor_id) : undefined
      const short = floor ? floorShortLabel(floor) : "—"
      const aptId = loc ? apartmentAncestorId(loc.id, locationById) : null
      const aptName = aptId ? locationById.get(aptId)?.name : undefined
      floorLabel = aptName ? `${short} · ${aptName}` : short
    }
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mime_type,
      sizeBytes: file.size_bytes,
      createdAt: file.created_at,
      category: file.category,
      floorLabel,
      url: urls.get(file.storage_path) ?? null,
    }
  })

  const apartments = locations
    .filter((l) => l.type === "apartment")
    .sort((a, b) => a.name.localeCompare(b.name, "pl", { numeric: true }))
    .map((l) => ({ id: l.id, name: l.name, floorId: l.floor_id }))

  return (
    <main className="px-4 py-6 md:px-6 lg:px-10">
      <h1 className="mb-6 text-2xl font-bold">Pliki</h1>
      <FilesUploadPanel projectId={id} floors={floors} apartments={apartments} />
      <ProjectFilesClient
        rows={rows}
        counts={counts}
        total={total}
        active={category}
        hasMore={hasMore}
        limit={limit}
      />
    </main>
  )
}
