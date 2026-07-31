import { LobbyBar } from "@/components/app-shell/LobbyBar"

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LobbyBar />
      {children}
    </>
  )
}
