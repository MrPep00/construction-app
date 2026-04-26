"use client"

import { useEffect } from "react"
import { XIcon } from "lucide-react"

interface Props {
  src: string
  filename: string
  uploadedAt: string
  onClose: () => void
}

export function Lightbox({ src, filename, uploadedAt, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const date = new Date(uploadedAt).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-5xl flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-10 right-0 flex size-8 items-center justify-center rounded-full text-white/70 hover:text-white"
          aria-label="Zamknij"
        >
          <XIcon className="size-5" />
        </button>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={filename}
          className="max-h-[80vh] w-full rounded object-contain"
        />

        <p className="text-center text-sm text-white/70">
          <span className="font-medium text-white">{filename}</span>
          {" · "}
          {date}
        </p>
      </div>
    </div>
  )
}
