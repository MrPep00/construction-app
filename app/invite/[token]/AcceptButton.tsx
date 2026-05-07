"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { acceptInvitation } from "@/lib/actions/team"

export function AcceptButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleAccept() {
    setLoading(true)
    const result = await acceptInvitation(token)
    setLoading(false)

    if (result.error === "already_in_this_team") {
      toast.info("Jesteś już członkiem tego zespołu")
      router.push("/projects")
      return
    }

    if (result.error) {
      toast.error(
        result.error === "already_in_team"
          ? "Jesteś już w innym zespole. W obecnej wersji aplikacji można być tylko w jednym zespole."
          : result.error
      )
      return
    }

    toast.success("Dołączyłeś do zespołu!")
    router.push("/projects")
  }

  return (
    <Button onClick={handleAccept} disabled={loading} size="lg">
      {loading ? "Dołączanie..." : "Dołącz do zespołu"}
    </Button>
  )
}
