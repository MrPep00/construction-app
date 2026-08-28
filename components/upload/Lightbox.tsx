"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react"

export type LightboxImage = {
  src: string
  filename: string
  uploadedAt?: string
}

type SingleProps = { src: string; filename: string; uploadedAt: string }
type GalleryProps = { images: LightboxImage[]; initialIndex?: number }
type Props = (SingleProps | GalleryProps) & { onClose: () => void }

export function Lightbox(props: Props) {
  const { onClose } = props
  const images: LightboxImage[] =
    "images" in props
      ? props.images
      : [{ src: props.src, filename: props.filename, uploadedAt: props.uploadedAt }]
  const count = images.length

  const [index, setIndex] = useState(() => {
    const initial = "images" in props ? (props.initialIndex ?? 0) : 0
    return Math.min(Math.max(initial, 0), Math.max(count - 1, 0))
  })
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0))
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, count - 1))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, count])

  const current = images[Math.min(index, count - 1)]

  const date = current.uploadedAt
    ? new Date(current.uploadedAt).toLocaleDateString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-5xl flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return
          const dx = e.changedTouches[0].clientX - touchStartX.current
          touchStartX.current = null
          if (Math.abs(dx) < 48) return
          if (dx > 0) setIndex((i) => Math.max(i - 1, 0))
          else setIndex((i) => Math.min(i + 1, count - 1))
        }}
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
          src={current.src}
          alt={current.filename}
          className="max-h-[80vh] w-full rounded object-contain"
        />

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(i - 1, 0))}
              disabled={index === 0}
              className="absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-opacity hover:bg-black/70 disabled:opacity-30"
              aria-label="Poprzednie zdjęcie"
            >
              <ChevronLeftIcon className="size-6" />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(i + 1, count - 1))}
              disabled={index === count - 1}
              className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-opacity hover:bg-black/70 disabled:opacity-30"
              aria-label="Następne zdjęcie"
            >
              <ChevronRightIcon className="size-6" />
            </button>
          </>
        )}

        <p className="text-center text-sm text-white/70">
          <span className="font-medium text-white">{current.filename}</span>
          {date && (
            <>
              {" · "}
              {date}
            </>
          )}
          {count > 1 && (
            <>
              {" · "}
              {index + 1} / {count}
            </>
          )}
        </p>
      </div>
    </div>
  )
}
