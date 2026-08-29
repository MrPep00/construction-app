import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DeleteProjectButton } from "./delete-project-button"
import { LobbyBar } from "@/components/app-shell/LobbyBar"
import { formatTimestampPl } from "@/lib/dates"

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, created_at")
    .order("created_at", { ascending: false })

  return (
    <>
    <LobbyBar />
    <main className="container mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Moje projekty</h1>
        <Link href="/projects/new" className={buttonVariants()}>
          Nowy projekt
        </Link>
      </div>

      {!projects?.length ? (
        <p className="py-12 text-center text-muted-foreground">
          Brak projektów. Utwórz pierwszy projekt, aby zacząć.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle>
                      <Link
                        href={`/projects/${project.id}`}
                        className="hover:underline"
                      >
                        {project.name}
                      </Link>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {formatTimestampPl(new Date(project.created_at), {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </CardDescription>
                  </div>
                  <DeleteProjectButton id={project.id} name={project.name} />
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </main>
    </>
  )
}
