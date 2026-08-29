"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react"
import { formatTimestampPl } from "@/lib/dates"

/** Thumbs rendered on each side of the current photo. */
const THUMB_WINDOW = 5

export type LightboxImage = {
  src: string
  filename: string
  uploadedAt?: string
}

type Props = {
  images: LightboxImage[]
  initialIndex?: number
  onClose: () => void
}

/** Gallery viewer. A single-image gallery simply renders no strip and no chevrons. */
export function Lightbox({ images, initialIndex, onClose }: Props) {
  const count = images.length

  const [index, setIndex] = useState(() =>
    Math.min(Math.max(initialIndex ?? 0, 0), Math.max(count - 1, 0))
  )
  const touchStartX = useRef<number | null>(null)
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([])
  const showStrip = count > 1
  // Only a window of thumbs around the current photo is mounted. Thumbs reuse the
  // full-size signed URL, so mounting a whole 88-photo strip would pull ~200 MB.
  // Edges are not padded: photo 1 shows itself plus the next 5, nothing before it.
  const stripStart = Math.max(0, index - THUMB_WINDOW)
  const stripEnd = Math.min(count - 1, index + THUMB_WINDOW)

  useEffect(() => {
    // Arrows are listened for in the CAPTURE phase: when the Lightbox is opened
    // from inside a Base UI dialog, that dialog stops keydown propagation while
    // focus is trapped in its popup, so a bubble-phase listener never sees them.
    const onNav = (e: KeyboardEvent) => {
      const t = e.target
      // Never steal arrows from a focused text field behind the overlay.
      if (
        t instanceof HTMLElement &&
        (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))
      ) {
        return
      }
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0))
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, count - 1))
    }
    // Escape stays in the bubble phase on purpose. A dialog that swallows the key
    // closes the Lightbox itself, which keeps the ordering "first Escape closes
    // the Lightbox, second closes the dialog".
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onNav, true)
    window.addEventListener("keydown", onEsc)
    return () => {
      window.removeEventListener("keydown", onNav, true)
      window.removeEventListener("keydown", onEsc)
    }
  }, [onClose, count])

  // Keep the active thumbnail centred in the strip whichever way the index moved
  // (keys, chevrons, swipe, thumb click). block:"nearest" so the page never jumps.
  useEffect(() => {
    if (!showStrip) return
    thumbRefs.current[index]?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    })
  }, [index, showStrip])

  const current = count > 0 ? images[Math.min(index, count - 1)] : null

  const date = current?.uploadedAt
    ? formatTimestampPl(new Date(current.uploadedAt), {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

  if (!current) return null

  // Portalled to <body>: any ancestor that creates a stacking context — the
  // apartment side panel's `lg:sticky` wrapper, for one — would otherwise trap
  // this `fixed z-[60]` overlay inside it and let a body-level dialog paint on
  // top. Portalling keeps the overlay a sibling of those dialogs at every call
  // site, whatever the surrounding layout does.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/85 p-4"
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
          className={
            showStrip
              ? "max-h-[70vh] w-full rounded object-contain"
              : "max-h-[80vh] w-full rounded object-contain"
          }
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
          {showStrip && (
            <>
              {" · "}
              {index + 1} / {count}
            </>
          )}
        </p>

        {showStrip && (
          <div
            className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Miniatury"
          >
            {/* w-max + mx-auto: the group centres while it fits, and falls back to
                normal left-origin scrolling once it overflows. justify-center on the
                scroll container would instead make the left edge unreachable. */}
            <div className="mx-auto flex w-max gap-2">
              {images.slice(stripStart, stripEnd + 1).map((img, offset) => {
                // Absolute index — also the React key, so a sliding window reuses the
                // <img> nodes it still overlaps instead of remounting (and refetching).
                const i = stripStart + offset
                return (
                  <button
                    key={i}
                    type="button"
                    ref={(el) => {
                      thumbRefs.current[i] = el
                    }}
                    onClick={() => setIndex(i)}
                    aria-label={img.filename}
                    aria-current={i === index}
                    className={
                      i === index
                        ? "size-14 shrink-0 overflow-hidden rounded ring-2 ring-white"
                        : "size-14 shrink-0 overflow-hidden rounded opacity-60 transition-opacity hover:opacity-100"
                    }
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.src}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover"
                    />
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
