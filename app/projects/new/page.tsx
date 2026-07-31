import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { NewProjectForm } from "./new-project-form"
import { LobbyBar } from "@/components/app-shell/LobbyBar"

export default function NewProjectPage() {
  return (
    <>
    <LobbyBar />
    <main className="flex justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Nowy projekt</CardTitle>
          <CardDescription>
            Podaj nazwę projektu. System automatycznie utworzy 9 kondygnacji i 7
            lokalizacji dla każdej z nich.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewProjectForm />
        </CardContent>
      </Card>
    </main>
    </>
  )
}
