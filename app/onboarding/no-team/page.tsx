import { SignOutButton } from "@/components/sign-out-button"

export default function NoTeamPage() {
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
      <div className="max-w-sm text-center space-y-4">
        <h1 className="text-xl font-semibold">Brak dostępu do zespołu</h1>
        <p className="text-muted-foreground">
          Nie jesteś jeszcze w żadnym zespole. Aby korzystać z aplikacji, poproś
          o link zaproszeniowy osobę, która ma już konto.
        </p>
        <SignOutButton />
      </div>
    </main>
  )
}
