import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
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

export default async function ProjectIssuesPage({
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
      .order("created_at", { ascending: false }),
  ])

  const floors = floorsRes.data ?? []
  const issues = (issuesRes.data ?? []) as unknown as JoinedIssue[]

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
      thumbUrl: null,
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
      />
    </main>
  )
}
