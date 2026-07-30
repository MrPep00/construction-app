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
  const { data: floors } = await supabase.from("floors").select("id").eq("project_id", id)
  const floorIds = floors?.map((f) => f.id) ?? []
  if (floorIds.length > 0) {
    const { data: locations } = await supabase
      .from("locations")
      .select("id")
      .in("floor_id", floorIds)
    const locationIds = locations?.map((l) => l.id) ?? []
    if (locationIds.length > 0) {
      const { count } = await supabase
        .from("issues")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .in("location_id", locationIds)
      openIssueCount = count ?? 0
    }
  }

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
    >
      {children}
    </AppShell>
  )
}
