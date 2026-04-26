import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TYPE_ICONS } from "@/components/tree/LocationNode"
import { FileUploader } from "@/components/upload/FileUploader"
import { FileGrid } from "@/components/upload/FileGrid"

export default async function LocationPage({
  params,
}: {
  params: Promise<{ id: string; level: string; locationId: string }>
}) {
  const { id, level: levelStr, locationId } = await params
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

  const { data: location } = await supabase
    .from("locations")
    .select("id, name, type, parent_id")
    .eq("id", locationId)
    .eq("floor_id", floor.id)
    .single()

  if (!location) return notFound()

  // Fetch direct children to render as a sublocation list
  const { data: children } = await supabase
    .from("locations")
    .select("id, name, type, sort_order")
    .eq("parent_id", locationId)
    .order("sort_order")

  // Build breadcrumb path by walking up parent chain
  const breadcrumbParts: { id: string; name: string }[] = []
  let current: { parent_id: string | null; name: string; id: string } = location

  while (current.parent_id) {
    const { data: parent } = await supabase
      .from("locations")
      .select("id, name, parent_id")
      .eq("id", current.parent_id)
      .single()

    if (!parent) break
    breadcrumbParts.unshift({ id: parent.id, name: parent.name })
    current = parent
  }

  const icon = TYPE_ICONS[location.type] ?? "📁"

  return (
    <main className="container mx-auto max-w-3xl px-4 py-6">
      <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground">
          Projekty
        </Link>
        <span>/</span>
        <Link href={`/projects/${id}`} className="hover:text-foreground">
          {project.name}
        </Link>
        <span>/</span>
        <Link
          href={`/projects/${id}/floors/${level}`}
          className="hover:text-foreground"
        >
          {floor.label}
        </Link>
        {breadcrumbParts.map((part) => (
          <span key={part.id} className="flex items-center gap-1.5">
            <span>/</span>
            <Link
              href={`/projects/${id}/floors/${level}/${part.id}`}
              className="hover:text-foreground"
            >
              {part.name}
            </Link>
          </span>
        ))}
        <span>/</span>
        <span className="text-foreground">{location.name}</span>
      </nav>

      <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <span>{icon}</span>
        <span>{location.name}</span>
      </h1>

      {children && children.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Podfoldery i lokalizacje
          </h2>
          <ul className="space-y-1">
            {children.map((child) => (
              <li key={child.id}>
                <Link
                  href={`/projects/${id}/floors/${level}/${child.id}`}
                  className="flex min-h-[44px] items-center gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <span className="shrink-0 text-base leading-none">
                    {TYPE_ICONS[child.type] ?? "📁"}
                  </span>
                  <span className="font-medium">{child.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Pliki
        </h2>
        <FileUploader locationId={locationId} />
        <div className="mt-6">
          <FileGrid locationId={locationId} />
        </div>
      </section>
    </main>
  )
}
