import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { resolveFileUrls } from "@/lib/storage"
import {
  apartmentAncestorId,
  shortFloorLabel,
  type LocationNode,
} from "@/lib/locations"
import {
  GlobalIssuesClient,
  type GlobalIssueRow,
} from "@/components/issues/GlobalIssuesClient"

type JoinedIssue = {
  id: string
  title: string
  status: "open" | "resolved"
  created_at: string
  contractor: string | null
  location_id: string
  location: {
    id: string
    name: string
    parent_id: string | null
    floor_id: string
    floor: { id: string; level: number; project_id: string }
  }
}

const DEFAULT_LIMIT = 200
const MAX_LIMIT = 2000

export default async function ProjectIssuesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ limit?: string }>
}) {
  const { id } = await params
  const { limit: limitParam } = await searchParams
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

  const [floorsRes, issuesRes] = await Promise.all([
    supabase
      .from("floors")
      .select("id, level, label")
      .eq("project_id", id)
      .order("level", { ascending: false }),
    supabase
      .from("issues")
      .select(
        "id, title, status, created_at, contractor, location_id, location:locations!inner(id, name, parent_id, floor_id, floor:floors!inner(id, level, project_id))"
      )
      .eq("location.floor.project_id", id)
      .order("created_at", { ascending: false })
      .limit(limit + 1),
  ])

  const floors = floorsRes.data ?? []
  const fetched = (issuesRes.data ?? []) as unknown as JoinedIssue[]
  const hasMore = fetched.length > limit
  const issues = hasMore ? fetched.slice(0, limit) : fetched

  const floorIds = floors.map((f) => f.id)
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

  // First photo per issue for the 64px row thumb
  const issueIds = issues.map((i) => i.id)
  const { data: photosData } =
    issueIds.length > 0
      ? await supabase
          .from("files")
          .select("issue_id, storage_path, storage_provider, created_at")
          .in("issue_id", issueIds)
          .like("mime_type", "image/%")
          .order("created_at", { ascending: true })
      : { data: [] }

  const firstPhotoByIssue = new Map<
    string,
    { storage_path: string; storage_provider: "supabase" | "r2" }
  >()
  photosData?.forEach((p) => {
    if (p.issue_id && !firstPhotoByIssue.has(p.issue_id)) {
      firstPhotoByIssue.set(p.issue_id, p)
    }
  })
  const thumbUrls = await resolveFileUrls(
    [...firstPhotoByIssue.values()],
    supabase
  )

  const rows: GlobalIssueRow[] = issues.map((issue) => {
    const aptId = apartmentAncestorId(issue.location_id, locationById)
    const labelName = aptId
      ? (locationById.get(aptId)?.name ?? issue.location.name)
      : issue.location.name
    return {
      id: issue.id,
      title: issue.title,
      status: issue.status,
      createdAt: issue.created_at,
      contractor: issue.contractor,
      floorId: issue.location.floor_id,
      apartmentId: aptId,
      locationLabel: `${labelName} · ${shortFloorLabel(issue.location.floor.level)}`,
      href: `/projects/${id}/floors/${issue.location.floor.level}/${issue.location_id}`,
      thumbUrl: (() => {
        const photo = firstPhotoByIssue.get(issue.id)
        return photo ? (thumbUrls.get(photo.storage_path) ?? null) : null
      })(),
    }
  })

  const apartments = locations
    .filter((l) => l.type === "apartment")
    .sort((a, b) => a.name.localeCompare(b.name, "pl", { numeric: true }))
    .map((l) => ({ id: l.id, name: l.name, floorId: l.floor_id }))

  return (
    <main className="px-4 py-6 md:px-6 lg:px-10">
      <h1 className="mb-6 text-2xl font-bold">Usterki</h1>
      <GlobalIssuesClient
        rows={rows}
        floors={floors}
        apartments={apartments}
        hasMore={hasMore}
        limit={limit}
      />
    </main>
  )
}
