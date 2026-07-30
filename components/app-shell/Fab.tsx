"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CameraIcon } from "lucide-react"

const LOCATION_PATH = /^\/projects\/[^/]+\/floors\/[^/]+\/[^/]+$/

interface Props {
  projectId: string
}

/**
 * Camera-first defect capture. On a location page opens the new-issue
 * dialog directly (?nowa-usterka=1 — IssueForm has capture="environment");
 * elsewhere routes to the dashboard to pick a location first.
 */
export function Fab({ projectId }: Props) {
  const pathname = usePathname()
  const onLocationPage = LOCATION_PATH.test(pathname)
  const href = onLocationPage ? `${pathname}?nowa-usterka=1` : `/projects/${projectId}`

  return (
    <Link
      href={href}
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-brand text-on-brand shadow-lg transition-colors hover:bg-brand-strong lg:hidden"
      aria-label="Zgłoś usterkę ze zdjęciem"
    >
      <CameraIcon className="size-6" />
    </Link>
  )
}
