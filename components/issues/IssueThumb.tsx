"use client"

import Image from "next/image"
import { ImageIcon } from "lucide-react"
import type { IssuePhoto } from "@/lib/issue-photos"

/**
 * 64px issue-row thumb. Button opens the photo lightbox (caller wires onOpen);
 * safe inside a linked card — click never reaches the surrounding Link.
 * Placeholder icon (non-interactive) when no photo has a resolvable URL.
 * Count pill only from 2 photos up.
 */
export function IssueThumb({
  photos,
  issueTitle,
  onOpen,
}: {
  photos: IssuePhoto[]
  issueTitle: string
  onOpen: () => void
}) {
  const thumb = photos.find((p) => p.url)

  if (!thumb?.url) {
    return (
      <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground/60">
        <ImageIcon className="size-6" />
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onOpen()
      }}
      className="relative size-16 shrink-0 overflow-hidden rounded-lg"
      aria-label={`Zdjęcia usterki: ${issueTitle}`}
    >
      <Image src={thumb.url} alt="" fill sizes="64px" className="object-cover" />
      {photos.length >= 2 && (
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-border bg-card px-1 text-[10px] font-semibold leading-none text-foreground">
          {photos.length}
        </span>
      )}
    </button>
  )
}
