"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  generateInvitationLink,
  revokeCurrentInvitation,
  removeMember,
} from "@/lib/actions/team"
import type { TeamWithMembers, ActiveInvitation } from "@/lib/actions/team"
import { formatTimestampPl } from "@/lib/dates"

function formatDate(iso: string) {
  return formatTimestampPl(new Date(iso), {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

// ----------------------------------------------------------------
// Member row
// ----------------------------------------------------------------
function MemberRow({
  member,
  teamId,
  onRemoved,
}: {
  member: TeamWithMembers["members"][number]
  teamId: string
  onRemoved: (userId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleRemove() {
    startTransition(async () => {
      const result = await removeMember(teamId, member.userId)
      setOpen(false)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${member.email} usunięty z zespołu`)
        onRemoved(member.userId)
      }
    })
  }

  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{member.email}</p>
        <p className="text-xs text-muted-foreground">
          dołączył(a) {formatDate(member.joinedAt)}
          {member.isAdmin && (
            <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
              admin
            </span>
          )}
        </p>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 text-destructive hover:text-destructive"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        Usuń
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć z zespołu?</AlertDialogTitle>
            <AlertDialogDescription>
              {member.email} straci dostęp do wszystkich projektów zespołu.
              Można ponownie zaprosić później.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? "Usuwanie..." : "Usuń z zespołu"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ----------------------------------------------------------------
// Invitation section
// ----------------------------------------------------------------
function InvitationSection({
  initialInvitation,
}: {
  initialInvitation: ActiveInvitation | null
}) {
  const [invitation, setInvitation] = useState<ActiveInvitation | null>(
    initialInvitation
  )
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function buildUrl(token: string) {
    return `${window.location.origin}/invite/${token}`
  }

  function handleCopy() {
    if (!invitation) return
    navigator.clipboard.writeText(buildUrl(invitation.token))
    toast.success("Link skopiowany do schowka")
  }

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateInvitationLink()
      if (result.error) {
        toast.error(result.error)
        return
      }
      setInvitation({
        id: "",
        token: result.data!.token,
        expires_at: result.data!.expiresAt,
        team_id: invitation?.team_id ?? "",
      })
      toast.success("Wygenerowano nowy link zaproszeniowy")
    })
  }

  function handleRevoke() {
    startTransition(async () => {
      const result = await revokeCurrentInvitation()
      setRevokeOpen(false)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setInvitation(null)
      toast.success("Zaproszenie odwołane")
    })
  }

  if (!invitation) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Brak aktywnego zaproszenia. Aby dodać kogoś do zespołu, wygeneruj link
          zaproszeniowy.
        </p>
        <Button onClick={handleGenerate} disabled={pending} size="sm">
          {pending ? "Generowanie..." : "Wygeneruj link zaproszeniowy"}
        </Button>
      </div>
    )
  }

  const url = buildUrl(invitation.token)

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Ważny do {formatDate(invitation.expires_at)}
      </p>

      <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-mono">{url}</span>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="shrink-0">
          Skopiuj
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Każdy kto kliknie ten link i się zaloguje zostanie dodany do zespołu.
        Link można wysłać dowolnym kanałem (WhatsApp, SMS, email).
      </p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleGenerate} disabled={pending} size="sm" variant="outline">
          {pending ? "Generowanie..." : "Wygeneruj nowy link"}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          className="text-destructive hover:text-destructive"
          onClick={() => setRevokeOpen(true)}
        >
          Odwołaj zaproszenie
        </Button>
      </div>

      <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odwołać zaproszenie?</AlertDialogTitle>
            <AlertDialogDescription>
              Aktywny link przestanie działać. Możesz wygenerować nowy w dowolnej
              chwili.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? "Odwoływanie..." : "Odwołaj"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ----------------------------------------------------------------
// Main export
// ----------------------------------------------------------------
export function TeamClient({
  team,
  invitation,
}: {
  team: TeamWithMembers | null
  invitation: ActiveInvitation | null
}) {
  const [members, setMembers] = useState(team?.members ?? [])

  if (!team) {
    return (
      <p className="text-muted-foreground">
        Nie jesteś przypisany do żadnego zespołu.
      </p>
    )
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Członkowie zespołu</h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Brak członków.</p>
        ) : (
          <div className="rounded-lg border px-3">
            {members.map((m) => (
              <MemberRow
                key={m.userId}
                member={m}
                teamId={team.id}
                onRemoved={(uid) =>
                  setMembers((prev) => prev.filter((x) => x.userId !== uid))
                }
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Aktywne zaproszenie</h2>
        <InvitationSection initialInvitation={invitation} />
      </section>
    </div>
  )
}
