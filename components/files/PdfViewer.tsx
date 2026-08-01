"use client"

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import {
  XIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  MinusIcon,
  MaximizeIcon,
  MoveHorizontalIcon,
  RotateCwIcon,
  DownloadIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface Props {
  src: string
  filename: string
  onClose: () => void
}

/** iOS Safari canvas area limit is ~16.7M px — stay under it. */
const PIXEL_BUDGET = 16_000_000
/** Multiplicative zoom step for buttons and keyboard. */
const ZOOM_STEP = 1.2
/** Zoom floor relative to fit-width. */
const MIN_SCALE_FACTOR = 0.25

type PageDims = { w: number; h: number }
type ContainerSize = { w: number; h: number }

function rotatedDims(dims: PageDims, rot: number): PageDims {
  return rot % 180 === 0 ? dims : { w: dims.h, h: dims.w }
}

function computeClamps(
  dims: PageDims | null,
  container: ContainerSize | null,
  rot: number
) {
  if (!dims || !container || container.w <= 0) {
    return { min: 0.1, max: Infinity, fitWidth: null as number | null, fitPage: null as number | null }
  }
  const r = rotatedDims(dims, rot)
  const fitWidth = container.w / r.w
  const fitPage = Math.min(fitWidth, container.h > 0 ? container.h / r.h : fitWidth)
  // Max zoom is budget-derived at DPR 1: CSS pixels alone must not exceed
  // the canvas budget, or large formats render blank despite the DPR guard.
  // Naturally dynamic per page format — an A4 zooms further than an A2.
  const max = Math.sqrt(PIXEL_BUDGET / (r.w * r.h))
  const min = Math.min(MIN_SCALE_FACTOR * fitWidth, max)
  return { min, max, fitWidth, fitPage }
}

export function PdfViewer({ src, filename, onClose }: Props) {
  const [mounted, setMounted] = useState(false)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [rotation, setRotation] = useState(0)
  /** Single numeric scale (react-pdf units: CSS px per PDF point).
   *  null until first page dims are known; fit-width is the 100% reference. */
  const [scale, setScale] = useState<number | null>(null)
  /** Page size at scale 1, unrotated (from the loaded page proxy). */
  const [pageDims, setPageDims] = useState<PageDims | null>(null)
  const [containerSize, setContainerSize] = useState<ContainerSize | null>(null)
  const [loadError, setLoadError] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const numPagesRef = useRef<number | null>(null)
  const scaleRef = useRef<number | null>(null)
  const pageDimsRef = useRef<PageDims | null>(null)
  const containerSizeRef = useRef<ContainerSize | null>(null)
  const rotationRef = useRef(0)
  /** Scroll anchor for zoom: keeps the container-center point fixed across a scale change. */
  const pendingAnchorRef = useRef<{ cx: number; cy: number; prevScale: number } | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = original }
  }, [])

  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { pageDimsRef.current = pageDims }, [pageDims])
  useEffect(() => { rotationRef.current = rotation }, [rotation])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const size = { w: el.clientWidth - 32, h: el.clientHeight - 32 }
      containerSizeRef.current = size
      setContainerSize(size)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Scale system ──────────────────────────────────────────────────────────
  // All fits and clamps derive from the rotated page box at scale 1.
  // Pure over its inputs: render passes state, callbacks pass refs.

  const getClamps = useCallback(() => {
    return computeClamps(pageDimsRef.current, containerSizeRef.current, rotationRef.current)
  }, [])

  const clamps = computeClamps(pageDims, containerSize, rotation)
  const fitWidthScale = clamps.fitWidth

  /** Set a new scale, clamped, keeping the container-center point fixed. */
  const applyZoom = useCallback((nextRaw: number) => {
    const { min, max } = getClamps()
    const next = Math.min(max, Math.max(min, nextRaw))
    const prev = scaleRef.current
    if (prev === null || Math.abs(next - prev) < 1e-6) return
    const el = containerRef.current
    if (el) {
      pendingAnchorRef.current = {
        cx: el.scrollLeft + el.clientWidth / 2,
        cy: el.scrollTop + el.clientHeight / 2,
        prevScale: prev,
      }
    }
    setScale(next)
  }, [getClamps])

  // Re-anchor scroll after the scaled page box has laid out.
  useLayoutEffect(() => {
    const anchor = pendingAnchorRef.current
    const el = containerRef.current
    if (!anchor || !el || scale === null) return
    pendingAnchorRef.current = null
    const k = scale / anchor.prevScale
    el.scrollLeft = anchor.cx * k - el.clientWidth / 2
    el.scrollTop = anchor.cy * k - el.clientHeight / 2
  }, [scale])

  // Initialize to fit-width once page dims + container are known.
  useEffect(() => {
    if (scale === null && fitWidthScale !== null) setScale(fitWidthScale)
  }, [scale, fitWidthScale])

  // Rotation or resize can shrink the budget-derived max — keep scale legal.
  useEffect(() => {
    if (scale === null) return
    const { min, max } = getClamps()
    if (scale > max || scale < min) setScale(Math.min(max, Math.max(min, scale)))
  }, [scale, rotation, containerSize, pageDims, getClamps])

  // ── Actions ───────────────────────────────────────────────────────────────

  const goToPrev = useCallback(() => {
    setPageNumber((p) => Math.max(1, p - 1))
  }, [])

  const goToNext = useCallback(() => {
    setPageNumber((p) => Math.min(numPagesRef.current ?? p, p + 1))
  }, [])

  const zoomIn = useCallback(() => {
    if (scaleRef.current !== null) applyZoom(scaleRef.current * ZOOM_STEP)
  }, [applyZoom])

  const zoomOut = useCallback(() => {
    if (scaleRef.current !== null) applyZoom(scaleRef.current / ZOOM_STEP)
  }, [applyZoom])

  const fitWidth = useCallback(() => {
    const { fitWidth } = getClamps()
    if (fitWidth !== null) applyZoom(fitWidth)
  }, [applyZoom, getClamps])

  const fitPage = useCallback(() => {
    const { fitPage } = getClamps()
    if (fitPage !== null) applyZoom(fitPage)
  }, [applyZoom, getClamps])

  const rotate = useCallback(() => {
    setRotation((r) => (r + 90) % 360)
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") goToPrev()
      if (e.key === "ArrowRight") goToNext()
      if (e.key === "+" || e.key === "=") zoomIn()
      if (e.key === "-") zoomOut()
      if (e.key === "r" || e.key === "R") rotate()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose, goToPrev, goToNext, zoomIn, zoomOut, rotate])

  // Trackpad pinch / ctrl+wheel zoom, anchored to container center.
  // Non-passive listener — React's synthetic wheel can't preventDefault.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const current = scaleRef.current
      if (current === null) return
      applyZoom(current * (e.deltaY < 0 ? 1.1 : 1 / 1.1))
    }
    el.addEventListener("wheel", handleWheel, { passive: false })
    return () => el.removeEventListener("wheel", handleWheel)
  }, [applyZoom])

  // ── Document callbacks ────────────────────────────────────────────────────

  function handleLoadSuccess({ numPages: n }: { numPages: number }) {
    setNumPages(n)
    numPagesRef.current = n
    setLoadError(false)
  }

  function handlePageLoadSuccess(page: { originalWidth: number; originalHeight: number }) {
    const dims = { w: page.originalWidth, h: page.originalHeight }
    pageDimsRef.current = dims
    setPageDims(dims)
  }

  // Cap the render DPR so canvas pixels stay inside the budget on any device.
  const effectiveDims = pageDims ? rotatedDims(pageDims, rotation) : null
  const dpr =
    scale !== null && effectiveDims
      ? Math.min(
          typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
          Math.sqrt(PIXEL_BUDGET / (effectiveDims.w * scale * effectiveDims.h * scale))
        )
      : undefined

  const displayPercent =
    scale !== null && fitWidthScale ? Math.round((scale / fitWidthScale) * 100) : null
  const atMax = scale !== null && scale >= clamps.max * 0.999
  const atMin = scale !== null && scale <= clamps.min * 1.001

  const skeleton = (
    <div
      className="animate-pulse rounded-lg bg-muted"
      style={{
        width: containerSize?.w ?? "100%",
        height: containerSize ? Math.min(containerSize.h, containerSize.w * 1.3) : "70vh",
      }}
    />
  )

  const toolbarBtn =
    "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md hover:bg-muted disabled:opacity-40 md:min-h-0 md:min-w-0 md:px-2"

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b bg-background px-4 py-2">
        <h2 className="max-w-[calc(100%-3rem)] truncate text-sm font-medium">
          {filename}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij podgląd"
          className="flex size-8 items-center justify-center rounded-md hover:bg-muted"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b bg-muted/40 px-3 py-1.5">
        {/* Page nav */}
        <button
          type="button"
          onClick={goToPrev}
          disabled={pageNumber <= 1}
          aria-label="Poprzednia strona"
          className={cn(toolbarBtn, "px-2")}
        >
          <ChevronLeftIcon className="size-4" />
        </button>

        <span className="whitespace-nowrap px-1 text-xs text-muted-foreground">
          Strona {pageNumber} z {numPages ?? "…"}
        </span>

        <button
          type="button"
          onClick={goToNext}
          disabled={pageNumber >= (numPages ?? 1)}
          aria-label="Następna strona"
          className={cn(toolbarBtn, "px-2")}
        >
          <ChevronRightIcon className="size-4" />
        </button>

        <div className="mx-1 h-4 w-px bg-border" />

        {/* Zoom — % is relative to fit-width (= 100%) */}
        <button
          type="button"
          onClick={zoomOut}
          disabled={atMin}
          aria-label="Pomniejsz"
          className={toolbarBtn}
        >
          <MinusIcon className="size-4" />
        </button>

        <span className="min-w-[3.5rem] text-center text-xs tabular-nums">
          {displayPercent !== null ? `${displayPercent}%` : "—"}
        </span>

        <button
          type="button"
          onClick={zoomIn}
          disabled={atMax}
          aria-label="Powiększ"
          className={toolbarBtn}
        >
          <PlusIcon className="size-4" />
        </button>

        <button
          type="button"
          onClick={fitWidth}
          aria-label="Dopasuj szerokość"
          className={cn(toolbarBtn, "gap-1 text-xs")}
        >
          <MoveHorizontalIcon className="size-3.5" />
          <span className="hidden lg:inline">Dopasuj szerokość</span>
        </button>

        <button
          type="button"
          onClick={fitPage}
          aria-label="Dopasuj stronę"
          className={cn(toolbarBtn, "gap-1 text-xs")}
        >
          <MaximizeIcon className="size-3.5" />
          <span className="hidden lg:inline">Dopasuj stronę</span>
        </button>

        <button
          type="button"
          onClick={rotate}
          aria-label="Obróć"
          className={cn(toolbarBtn, "gap-1 text-xs")}
        >
          <RotateCwIcon className="size-3.5" />
          <span className="hidden lg:inline">Obrót</span>
        </button>

        <div className="mx-1 h-4 w-px bg-border" />

        {/* Download */}
        <a
          href={src}
          download={filename}
          aria-label="Pobierz plik"
          className={cn(toolbarBtn, "gap-1 text-xs")}
        >
          <DownloadIcon className="size-3.5" />
          <span className="hidden sm:inline">Pobierz</span>
        </a>
      </div>

      {/* Document body — PDF canvas stays white, never theme-filtered */}
      <div
        ref={containerRef}
        className="flex flex-1 items-start justify-center overflow-auto overscroll-contain p-4"
        style={{ touchAction: "pinch-zoom pan-x pan-y" }}
      >
        {loadError ? (
          <div className="flex flex-col items-center gap-3 pt-16 text-center">
            <p className="text-sm text-muted-foreground">
              Nie udało się załadować pliku. Spróbuj go pobrać.
            </p>
            <a
              href={src}
              download={filename}
              className="text-sm font-medium text-primary underline underline-offset-4"
            >
              Pobierz plik
            </a>
          </div>
        ) : (
          <div className="min-w-fit">
            <Document
              file={src}
              onLoadSuccess={handleLoadSuccess}
              onLoadError={() => setLoadError(true)}
              loading={skeleton}
            >
              <Page
                pageNumber={pageNumber}
                rotate={rotation}
                onLoadSuccess={handlePageLoadSuccess}
                loading={skeleton}
                // Until dims arrive, render at fit-width via width so the
                // scale init (scale = fitWidthScale) causes no visual jump.
                {...(scale !== null
                  ? { scale, devicePixelRatio: dpr }
                  : { width: containerSize?.w })}
              />
            </Document>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
