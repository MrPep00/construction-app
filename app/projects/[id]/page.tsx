import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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

  // Fetch all location ids + floor_id for this project in one query
  const { data: allLocations } = await supabase
    .from("locations")
    .select("id, floor_id")
    .in("floor_id", floorIds)

  const locationsByFloor: Record<string, number> = Object.fromEntries(
    floorIds.map((fid) => [
      fid,
      allLocations?.filter((l) => l.floor_id === fid).length ?? 0,
    ])
  )

  // Map location id → floor id to count open issues per floor
  const locationIdToFloorId: Record<string, string> = {}
  allLocations?.forEach((l) => {
    locationIdToFloorId[l.id] = l.floor_id
  })

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {floorList.map((floor) => (
          <Link
            key={floor.id}
            href={`/projects/${id}/floors/${floor.level}`}
            className="block"
          >
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader>
                <CardTitle className="text-base">{floor.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="flex gap-6 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Lokalizacje</dt>
                    <dd className="font-medium">
                      {locationsByFloor[floor.id] ?? 0}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Otwarte usterki</dt>
                    <dd className="font-medium">
                      {openIssuesByFloor[floor.id] ?? 0}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  )
}
