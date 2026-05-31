import Link from "next/link"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { buttonVariants } from "@/components/ui/button"
import { ProjectTasksSidePanel } from "@/components/tasks/ProjectTasksSidePanel"

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

  // Fetch locations with type and parent_id for apartment counting
  const { data: allLocations } = await supabase
    .from("locations")
    .select("id, floor_id, type, parent_id")
    .in("floor_id", floorIds)

  const locationIdToFloorId: Record<string, string> = {}
  allLocations?.forEach((l) => {
    locationIdToFloorId[l.id] = l.floor_id
  })

  // Count apartments (type='apartment') per floor
  const tenantChangesByFloor: Record<string, number> = Object.fromEntries(
    floorIds.map((fid) => [fid, 0])
  )
  allLocations?.forEach((l) => {
    if (l.type === "apartment") {
      tenantChangesByFloor[l.floor_id] = (tenantChangesByFloor[l.floor_id] ?? 0) + 1
    }
  })

  // Count open issues per floor
  const openIssuesByFloor: Record<string, number> = Object.fromEntries(
    floorIds.map((fid) => [fid, 0])
  )
  const locationIds = Object.keys(locationIdToFloorId)
  if (locationIds.length > 0) {
    const { data: openIssues } = await supabase
      .from("issues")
      .select("location_id")
      .eq("status", "open")
      .in("location_id", locationIds)

    openIssues?.forEach((issue) => {
      const fid = locationIdToFloorId[issue.location_id]
      if (fid) openIssuesByFloor[fid] = (openIssuesByFloor[fid] ?? 0) + 1
    })
  }

  // Count active tasks (todo + doing) per floor
  const activeTasksByFloor: Record<string, number> = Object.fromEntries(
    floorIds.map((fid) => [fid, 0])
  )
  if (floorIds.length > 0) {
    const { data: activeTasks } = await supabase
      .from("tasks")
      .select("floor_id")
      .in("floor_id", floorIds)
      .in("status", ["todo", "doing"])

    activeTasks?.forEach((task) => {
      if (task.floor_id) {
        activeTasksByFloor[task.floor_id] = (activeTasksByFloor[task.floor_id] ?? 0) + 1
      }
    })
  }

  return (
    <main className="container mx-auto max-w-5xl px-4 py-6">
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
            href={`/projects/${id}/tasks`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Zadania globalne
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
        <div className="flex flex-col gap-0.5">
          {floorList.map((floor) => {
            const issues = openIssuesByFloor[floor.id] ?? 0
            const tasks = activeTasksByFloor[floor.id] ?? 0
            const apartments = tenantChangesByFloor[floor.id] ?? 0

            return (
              <Link
                key={floor.id}
                href={`/projects/${id}/floors/${floor.level}`}
                className="flex min-h-[44px] items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50 md:min-h-0 md:py-1.5"
              >
                <span>{floor.label}</span>
                <div className="flex items-center gap-2 text-xs">
                  {issues > 0 && (
                    <span className="rounded-full bg-red-100 px-1.5 py-0.5 font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      {issues} usterek
                    </span>
                  )}
                  {tasks > 0 && (
                    <span className="rounded-full bg-blue-100 px-1.5 py-0.5 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {tasks} zadań
                    </span>
                  )}
                  {apartments > 0 && (
                    <span className="text-muted-foreground">
                      🏠 {apartments}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
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
