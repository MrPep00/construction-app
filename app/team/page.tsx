import Link from "next/link"
import { requireAdmin } from "@/lib/auth/admin-check"
import {
  getCurrentTeamWithMembers,
  listActiveInvitation,
} from "@/lib/actions/team"
import { TeamClient } from "./TeamClient"

export default async function TeamPage() {
  await requireAdmin()

  const [teamResult, invitationResult] = await Promise.all([
    getCurrentTeamWithMembers(),
    listActiveInvitation(),
  ])

  return (
    <main className="container mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Zespół</h1>
        <Link
          href="/projects"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Projekty
        </Link>
      </div>

      <TeamClient
        team={teamResult.data}
        invitation={invitationResult.data}
      />
    </main>
  )
}
