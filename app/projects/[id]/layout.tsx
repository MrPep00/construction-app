import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/auth/admin-check"
import { fetchAdminErrorStats } from "@/lib/supabase/admin-context"
import { AppShell } from "@/components/app-shell/AppShell"

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Unauthenticated: pages handle their own redirect; render without shell
  if (!user) return <>{children}</>

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", id)
    .single()

  let openIssueCount = 0
  const { data: floors } = await supabase
    .from("floors")
    .select("id, level, label")
    .eq("project_id", id)
    .order("level", { ascending: false })
  const floorIds = floors?.map((f) => f.id) ?? []
  let locations: { id: string; name: string; type: string; floor_id: string }[] = []
  if (floorIds.length > 0) {
    const { data: locationsData } = await supabase
      .from("locations")
      .select("id, name, type, floor_id")
      .in("floor_id", floorIds)
    locations = locationsData ?? []
    const locationIds = locations.map((l) => l.id)
    if (locationIds.length > 0) {
      const { count } = await supabase
        .from("issues")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .in("location_id", locationIds)
      openIssueCount = count ?? 0
    }
  }

  // FAB new-issue dialog: floor→apartment cascade options
  const apartments = locations
    .filter((l) => l.type === "apartment")
    .sort((a, b) => a.name.localeCompare(b.name, "pl", { numeric: true }))
    .map((l) => ({ id: l.id, name: l.name, floorId: l.floor_id }))

  const adminUser = isAdmin(user.email)
  let unresolvedErrorCount = 0
  if (adminUser) {
    const { data } = await fetchAdminErrorStats()
    unresolvedErrorCount = data?.total_unresolved ?? 0
  }

  return (
    <AppShell
      projectId={id}
      projectName={project?.name ?? "Projekt"}
      openIssueCount={openIssueCount}
      isAdminUser={adminUser}
      unresolvedErrorCount={unresolvedErrorCount}
      userEmail={user.email ?? ""}
      floors={floors ?? []}
      apartments={apartments}
    >
      {children}
    </AppShell>
  )
}
