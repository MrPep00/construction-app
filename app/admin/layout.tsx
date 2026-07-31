import { LobbyBar } from "@/components/app-shell/LobbyBar"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LobbyBar />
      {children}
    </>
  )
}
