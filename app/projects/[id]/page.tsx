import Link from "next/link"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { buttonVariants } from "@/components/ui/button"
import { ProjectTasksSidePanel } from "@/components/tasks/ProjectTasksSidePanel"
import { BuildingMatrix, type MatrixRow } from "@/components/dashboard/BuildingMatrix"

type LocationRow = {
  id: string
  floor_id: string
  parent_id: string | null
  name: string
  type: string
  sort_order: number
}

/** Walks parent_id chain to the containing apartment (issues may sit on rooms). */
function apartmentAncestorId(
  locationId: string,
  byId: Map<string, LocationRow>
): string | null {
  let current = byId.get(locationId)
  let guard = 0
  while (current && guard++ < 20) {
    if (current.type === "apartment") return current.id
    current = current.parent_id ? byId.get(current.parent_id) : undefined
  }
  return null
}

export default async function ProjectDashboardPage({
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

  const { data: floors } = await supabase
    .from("floors")
    .select("id, level, label")
    .eq("project_id", id)
    .order("level", { ascending: false })

  const floorList = floors ?? []
  const floorIds = floorList.map((f) => f.id)

  const { data: allLocations } = await supabase
    .from("locations")
    .select("id, floor_id, parent_id, name, type, sort_order")
    .in("floor_id", floorIds)

  const locations: LocationRow[] = allLocations ?? []
  const locationById = new Map(locations.map((l) => [l.id, l]))

  // Open-issue count per apartment (issues on rooms roll up to the apartment)
  const openCountByApartment = new Map<string, number>()
  if (locations.length > 0) {
    const { data: openIssues } = await supabase
      .from("issues")
      .select("location_id")
      .eq("status", "open")
      .in("location_id", locations.map((l) => l.id))

    openIssues?.forEach((issue) => {
      const aptId = apartmentAncestorId(issue.location_id, locationById)
      if (aptId) {
        openCountByApartment.set(aptId, (openCountByApartment.get(aptId) ?? 0) + 1)
      }
    })
  }

  const matrixRows: MatrixRow[] = floorList.map((floor) => ({
    floorId: floor.id,
    level: floor.level,
    label: floor.label,
    apartments: locations
      .filter((l) => l.floor_id === floor.id && l.type === "apartment")
      .sort(
        (a, b) =>
          a.sort_order - b.sort_order ||
          a.name.localeCompare(b.name, "pl", { numeric: true })
      )
      .map((l) => ({
        id: l.id,
        name: l.name,
        openCount: openCountByApartment.get(l.id) ?? 0,
      })),
  }))

  return (
    <main className="px-4 py-6 md:px-6 lg:px-10">
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground">
          Projekty
        </Link>
        <span>/</span>
        <span className="text-foreground">{project.name}</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/projects/${id}/inventory`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Inwentaryzacja
          </Link>
          <Link
            href={`/projects/${id}/notes`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Notatki
          </Link>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <BuildingMatrix projectId={id} rows={matrixRows} />

        <aside className="mt-6 lg:mt-0">
          <Suspense
            fallback={
              <div className="rounded-xl border bg-card p-4">
                <p className="text-sm text-muted-foreground">Ładowanie zadań...</p>
              </div>
            }
          >
            <ProjectTasksSidePanel projectId={id} />
          </Suspense>
        </aside>
      </div>
    </main>
  )
}
