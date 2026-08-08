import Link from "next/link"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { buttonVariants } from "@/components/ui/button"
import { ProjectTasksSidePanel } from "@/components/tasks/ProjectTasksSidePanel"
import { BuildingMatrix, type MatrixRow } from "@/components/dashboard/BuildingMatrix"
import { MetricCards } from "@/components/dashboard/MetricCards"
import { apartmentAncestorId } from "@/lib/locations"

/** Monday 00:00 of the current week (server time). */
function startOfWeek(): Date {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  d.setHours(0, 0, 0, 0)
  return d
}

type LocationRow = {
  id: string
  floor_id: string
  parent_id: string | null
  name: string
  type: string
  sort_order: number
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

  const locationIds = locations.map((l) => l.id)

  const [issuesRes, tasksRes] = await Promise.all([
    locationIds.length > 0
      ? supabase
          .from("issues")
          .select("id, location_id, status, resolved_at")
          .in("location_id", locationIds)
      : Promise.resolve({ data: [] }),
    supabase.from("tasks").select("id, status").eq("project_id", id),
  ])

  const issues = issuesRes.data ?? []
  const tasks = tasksRes.data ?? []

  const openIssues = issues.filter((i) => i.status === "open")
  const weekStart = startOfWeek()
  const resolvedThisWeek = issues.filter(
    (i) =>
      i.status === "resolved" &&
      i.resolved_at &&
      new Date(i.resolved_at) >= weekStart
  ).length
  const activeTasks = tasks.filter(
    (t) => t.status === "todo" || t.status === "doing"
  ).length

  const countFiles = (column: "location_id" | "floor_id" | "issue_id" | "task_id", ids: string[]) =>
    ids.length > 0
      ? supabase.from("files").select("id", { count: "exact", head: true }).in(column, ids)
      : Promise.resolve({ count: 0 })

  const fileCounts = await Promise.all([
    countFiles("location_id", locationIds),
    countFiles("floor_id", floorIds),
    countFiles("issue_id", issues.map((i) => i.id)),
    countFiles("task_id", tasks.map((t) => t.id)),
  ])
  const filesTotal = fileCounts.reduce((sum, r) => sum + (r.count ?? 0), 0)

  // Open-issue count per apartment (issues on rooms roll up to the apartment);
  // issues without an apartment ancestor roll up to their floor instead.
  const openCountByApartment = new Map<string, number>()
  const unassignedByFloor = new Map<string, number>()
  openIssues.forEach((issue) => {
    const aptId = apartmentAncestorId(issue.location_id, locationById)
    if (aptId) {
      openCountByApartment.set(aptId, (openCountByApartment.get(aptId) ?? 0) + 1)
      return
    }
    const floorId = locationById.get(issue.location_id)?.floor_id
    if (floorId) {
      unassignedByFloor.set(floorId, (unassignedByFloor.get(floorId) ?? 0) + 1)
    }
  })

  if (process.env.NODE_ENV !== "production") {
    const accounted =
      [...openCountByApartment.values()].reduce((a, b) => a + b, 0) +
      [...unassignedByFloor.values()].reduce((a, b) => a + b, 0)
    if (accounted !== openIssues.length) {
      console.warn(
        `dashboard matrix: ${openIssues.length} open issues but only ${accounted} accounted for in cells + floor badges`
      )
    }
  }

  const matrixRows: MatrixRow[] = floorList.map((floor) => ({
    floorId: floor.id,
    level: floor.level,
    label: floor.label,
    unassignedCount: unassignedByFloor.get(floor.id) ?? 0,
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
        <div>
          <MetricCards
            metrics={[
              {
                label: "Otwarte usterki",
                value: openIssues.length,
                href: `/projects/${id}/issues`,
              },
              {
                label: "Usunięte w tym tygodniu",
                value: resolvedThisWeek,
                href: `/projects/${id}/issues?status=resolved`,
              },
              {
                label: "Zadania w toku",
                value: activeTasks,
                href: `/projects/${id}/tasks`,
              },
              { label: "Pliki", value: filesTotal },
            ]}
          />
          <BuildingMatrix projectId={id} rows={matrixRows} />
        </div>

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
