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
/** Double-tap: max delay between taps and max travel per/between taps (px). */
const DOUBLE_TAP_MS = 300
const TAP_SLOP = 10
const DOUBLE_TAP_RADIUS = 25
/** Double-tap zoom-in target relative to fit-page. */
const DOUBLE_TAP_ZOOM = 2.5

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
  const pageWrapRef = useRef<HTMLDivElement>(null)
  const numPagesRef = useRef<number | null>(null)
  const scaleRef = useRef<number | null>(null)
  const pageDimsRef = useRef<PageDims | null>(null)
  const containerSizeRef = useRef<ContainerSize | null>(null)
  const rotationRef = useRef(0)
  /** Scroll anchor for zoom: keeps a chosen page point fixed at a chosen
   *  client position across a committed scale change. content* are page-wrapper
   *  coordinates at prevScale. */
  const pendingAnchorRef = useRef<{
    clientX: number
    clientY: number
    contentX: number
    contentY: number
    prevScale: number
  } | null>(null)
  /** Active touch pointers (client coords) on the scroll container. */
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  /** In-flight pinch. origin* = page-wrapper coords pinned at anchorClient*. */
  const pinchRef = useRef<{
    startDist: number
    startScale: number
    originX: number
    originY: number
    anchorClientX: number
    anchorClientY: number
    lastK: number
  } | null>(null)
  const tapStartRef = useRef<{ id: number; x: number; y: number } | null>(null)
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null)
  /** Snapshot overlay: keeps the previous render visible across a same-page
   *  scale commit until the new crisp render lands (flash-free zooming). */
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const overlayTimerRef = useRef<number | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = original }
  }, [])

  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { pageDimsRef.current = pageDims }, [pageDims])
  useEffect(() => { rotationRef.current = rotation }, [rotation])

  // ── TEMP DEBUG INSTRUMENTATION (Phase 1) — remove in fix commit ───────────
  const debugDump = useCallback((tag: string, extra: Record<string, unknown> = {}) => {
    const el = containerRef.current
    const c = computeClamps(pageDimsRef.current, containerSizeRef.current, rotationRef.current)
    console.table({
      tag,
      containerW: containerSizeRef.current?.w ?? null,
      containerH: containerSizeRef.current?.h ?? null,
      rawClientW: el ? el.clientWidth : "el=NULL",
      rawClientH: el ? el.clientHeight : "el=NULL",
      pageW: pageDimsRef.current?.w ?? null,
      pageH: pageDimsRef.current?.h ?? null,
      rotation: rotationRef.current,
      fitWidthScale: c.fitWidth,
      fitPageScale: c.fitPage,
      min: c.min,
      max: c.max,
      scale: scaleRef.current,
      ...extra,
    })
  }, [])
  // ── end TEMP DEBUG ─────────────────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current
    if (!el) {
      // TEMP DEBUG (Phase 1)
      console.warn("[PdfViewer DEBUG] observer effect ran with containerRef=NULL — ResizeObserver never attached")
      return
    }
    const update = () => {
      const size = { w: el.clientWidth - 32, h: el.clientHeight - 32 }
      containerSizeRef.current = size
      setContainerSize(size)
      debugDump("resize-update") // TEMP DEBUG (Phase 1)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [debugDump])

  // ── Scale system ──────────────────────────────────────────────────────────
  // All fits and clamps derive from the rotated page box at scale 1.
  // Pure over its inputs: render passes state, callbacks pass refs.

  const getClamps = useCallback(() => {
    return computeClamps(pageDimsRef.current, containerSizeRef.current, rotationRef.current)
  }, [])

  const clamps = computeClamps(pageDims, containerSize, rotation)
  const fitWidthScale = clamps.fitWidth

  // ── Flash-free scale commits: snapshot overlay ────────────────────────────

  const clearOverlay = useCallback(() => {
    if (overlayTimerRef.current !== null) {
      clearTimeout(overlayTimerRef.current)
      overlayTimerRef.current = null
    }
    const snap = overlayRef.current
    overlayRef.current = null
    if (snap) {
      snap.remove()
      // Zero the backing store so iOS frees the bitmap immediately
      snap.width = 0
      snap.height = 0
    }
  }, [])

  /** Copy the current render into an overlay CSS-sized to the TARGET
   *  geometry (soft, like the gesture preview) so the commit re-render can
   *  never show a blank frame. Removed on onRenderSuccess/-Error, with a
   *  2s timeout fallback so it can never get stuck. */
  const showSnapshotOverlay = useCallback((targetScale: number) => {
    const wrap = pageWrapRef.current
    const dims = pageDimsRef.current
    if (!wrap || !dims) return
    const r = rotatedDims(dims, rotationRef.current)
    const cssW = r.w * targetScale
    const cssH = r.h * targetScale

    const armTimeout = () => {
      if (overlayTimerRef.current !== null) clearTimeout(overlayTimerRef.current)
      overlayTimerRef.current = window.setTimeout(clearOverlay, 2000)
    }

    // Rapid successive commits: the previous snapshot is still the freshest
    // complete image (the live canvas may be mid-render) — just retarget it.
    const existing = overlayRef.current
    if (existing) {
      existing.style.width = `${cssW}px`
      existing.style.height = `${cssH}px`
      armTimeout()
      return
    }

    const src = wrap.querySelector<HTMLCanvasElement>("canvas:not([data-snapshot])")
    if (!src || src.width === 0 || src.height === 0) return
    const snap = document.createElement("canvas")
    snap.dataset.snapshot = "true"
    snap.width = src.width
    snap.height = src.height
    const ctx = snap.getContext("2d")
    if (!ctx) return
    ctx.drawImage(src, 0, 0)
    Object.assign(snap.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: `${cssW}px`,
      height: `${cssH}px`,
      pointerEvents: "none",
      zIndex: "10",
    })
    wrap.appendChild(snap)
    overlayRef.current = snap
    armTimeout()
  }, [clearOverlay])

  // Page navigation / rotation show the skeleton by design — drop any overlay.
  useEffect(() => { clearOverlay() }, [pageNumber, rotation, clearOverlay])
  useEffect(() => clearOverlay, [clearOverlay])

  /** Set a new scale, clamped, keeping the page point currently under
   *  (clientX, clientY) fixed at that client position. */
  const applyZoomAt = useCallback((nextRaw: number, clientX: number, clientY: number) => {
    const { min, max } = getClamps()
    const next = Math.min(max, Math.max(min, nextRaw))
    const prev = scaleRef.current
    debugDump("applyZoomAt", { nextRaw, clamped: next, prev, bailing: prev === null || Math.abs(next - (prev ?? 0)) < 1e-6 }) // TEMP DEBUG (Phase 1)
    if (prev === null || Math.abs(next - prev) < 1e-6) return
    const wrap = pageWrapRef.current
    if (wrap) {
      // Rect must be untransformed here — never call this mid-pinch-preview
      // (the pinch commit path fills pendingAnchorRef from gesture-start data).
      const rect = wrap.getBoundingClientRect()
      pendingAnchorRef.current = {
        clientX,
        clientY,
        contentX: clientX - rect.left,
        contentY: clientY - rect.top,
        prevScale: prev,
      }
    }
    showSnapshotOverlay(next)
    setScale(next)
  }, [getClamps, showSnapshotOverlay, debugDump])

  /** Zoom keeping the container center fixed (buttons, keyboard, wheel). */
  const applyZoom = useCallback((nextRaw: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    applyZoomAt(nextRaw, rect.left + rect.width / 2, rect.top + rect.height / 2)
  }, [applyZoomAt])

  // Re-anchor scroll after the scaled page box has laid out.
  useLayoutEffect(() => {
    const anchor = pendingAnchorRef.current
    const el = containerRef.current
    const wrap = pageWrapRef.current
    if (!anchor || !el || !wrap || scale === null) return
    pendingAnchorRef.current = null
    const k = scale / anchor.prevScale
    const rect = wrap.getBoundingClientRect()
    el.scrollLeft += rect.left + anchor.contentX * k - anchor.clientX
    el.scrollTop += rect.top + anchor.contentY * k - anchor.clientY
  }, [scale])

  // TEMP DEBUG (Phase 1): log every recompute of the scale system inputs.
  useEffect(() => {
    debugDump("recompute")
  }, [pageDims, containerSize, rotation, scale, debugDump])

  // Initialize to fit-width once page dims + container are known.
  useEffect(() => {
    if (scale === null && fitWidthScale !== null) {
      debugDump("scale-init", { initTo: fitWidthScale }) // TEMP DEBUG (Phase 1)
      setScale(fitWidthScale)
    }
  }, [scale, fitWidthScale, debugDump])

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
    debugDump("btn-zoom-in") // TEMP DEBUG (Phase 1)
    if (scaleRef.current !== null) applyZoom(scaleRef.current * ZOOM_STEP)
  }, [applyZoom, debugDump])

  const zoomOut = useCallback(() => {
    debugDump("btn-zoom-out") // TEMP DEBUG (Phase 1)
    if (scaleRef.current !== null) applyZoom(scaleRef.current / ZOOM_STEP)
  }, [applyZoom, debugDump])

  const fitWidth = useCallback(() => {
    debugDump("btn-fit-width") // TEMP DEBUG (Phase 1)
    const { fitWidth } = getClamps()
    if (fitWidth !== null) applyZoom(fitWidth)
  }, [applyZoom, getClamps, debugDump])

  const fitPage = useCallback(() => {
    debugDump("btn-fit-page") // TEMP DEBUG (Phase 1)
    const { fitPage } = getClamps()
    if (fitPage !== null) applyZoom(fitPage)
  }, [applyZoom, getClamps, debugDump])

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

  // ── Touch gestures: pinch + double-tap ────────────────────────────────────
  // Pointer events cannot cancel native scrolling, and with touch-action
  // "pan-x pan-y" a two-finger move is also a valid pan. This non-passive
  // touchmove listener suppresses native scroll ONLY while >= 2 pointers are
  // down; one-finger scroll + momentum stay fully native. Known limitation:
  // a scroll already in flight when the second finger lands may run out.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const block = (e: TouchEvent) => {
      if (pointersRef.current.size >= 2) e.preventDefault()
    }
    el.addEventListener("touchmove", block, { passive: false })
    return () => el.removeEventListener("touchmove", block)
  }, [])

  /** Commit the pinch preview: clear the CSS transform and re-render at the
   *  committed scale, keeping the pinned page point under the fingers.
   *  Fires on pointerup AND pointercancel — commit, not abort: the preview is
   *  what the user sees, and snapping back on an OS-initiated cancel would
   *  discard visible state; the clamp path makes commit always legal. */
  const endPinch = useCallback(() => {
    const pinch = pinchRef.current
    pinchRef.current = null
    const wrap = pageWrapRef.current
    if (!pinch) {
      if (wrap) {
        wrap.style.transform = ""
        wrap.style.transformOrigin = ""
        wrap.style.willChange = ""
      }
      return
    }
    const { min, max } = getClamps()
    const next = Math.min(max, Math.max(min, pinch.startScale * pinch.lastK))
    const changed = Math.abs(next - pinch.startScale) >= 1e-6
    // Snapshot BEFORE clearing the preview transform — same task, one paint:
    // the soft overlay replaces the equally-soft preview with no gap.
    if (changed) showSnapshotOverlay(next)
    if (wrap) {
      wrap.style.transform = ""
      wrap.style.transformOrigin = ""
      wrap.style.willChange = ""
    }
    if (!changed) return
    // Anchor from gesture-start data — the live rect is transform-contaminated
    pendingAnchorRef.current = {
      clientX: pinch.anchorClientX,
      clientY: pinch.anchorClientY,
      contentX: pinch.originX,
      contentY: pinch.originY,
      prevScale: pinch.startScale,
    }
    setScale(next)
  }, [getClamps, showSnapshotOverlay])

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "touch") return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointersRef.current.size === 1) {
      tapStartRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
      return
    }
    // Second finger: this is a pinch, not a tap
    tapStartRef.current = null
    lastTapRef.current = null
    if (pointersRef.current.size !== 2 || pinchRef.current) return
    const wrap = pageWrapRef.current
    const startScale = scaleRef.current
    if (!wrap || startScale === null) return
    const [a, b] = [...pointersRef.current.values()]
    const startDist = Math.hypot(a.x - b.x, a.y - b.y)
    if (startDist < 1) return
    const cx = (a.x + b.x) / 2
    const cy = (a.y + b.y) / 2
    const rect = wrap.getBoundingClientRect()
    pinchRef.current = {
      startDist,
      startScale,
      originX: cx - rect.left,
      originY: cy - rect.top,
      anchorClientX: cx,
      anchorClientY: cy,
      lastK: 1,
    }
    wrap.style.transformOrigin = `${cx - rect.left}px ${cy - rect.top}px`
    wrap.style.willChange = "transform"
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(e.pointerId)) return
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pinch = pinchRef.current
    const wrap = pageWrapRef.current
    if (!pinch || !wrap || pointersRef.current.size < 2) return
    const [a, b] = [...pointersRef.current.values()]
    const dist = Math.hypot(a.x - b.x, a.y - b.y)
    if (dist < 1) return
    // Clamp the preview to the committable range so gesture end never snaps
    const { min, max } = getClamps()
    const k = Math.min(
      max / pinch.startScale,
      Math.max(min / pinch.startScale, dist / pinch.startDist)
    )
    pinch.lastK = k
    wrap.style.transform = `scale(${k})`
  }

  function handleTap(x: number, y: number) {
    const now = Date.now()
    const last = lastTapRef.current
    if (
      last &&
      now - last.time < DOUBLE_TAP_MS &&
      Math.hypot(x - last.x, y - last.y) < DOUBLE_TAP_RADIUS
    ) {
      lastTapRef.current = null
      const { fitPage } = getClamps()
      const current = scaleRef.current
      if (fitPage === null || current === null) return
      const atFitPage = Math.abs(current - fitPage) / fitPage < 0.02
      // Zoom-in target still runs through the clamp path — budget max rules
      applyZoomAt(atFitPage ? DOUBLE_TAP_ZOOM * fitPage : fitPage, x, y)
    } else {
      lastTapRef.current = { time: now, x, y }
    }
  }

  function handlePointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "touch") return
    pointersRef.current.delete(e.pointerId)

    if (pinchRef.current) {
      if (pointersRef.current.size < 2) endPinch()
      return
    }

    // Tap detection (pointerup only — a cancelled pointer is not a tap)
    const tapStart = tapStartRef.current
    tapStartRef.current = null
    if (
      e.type === "pointerup" &&
      tapStart &&
      tapStart.id === e.pointerId &&
      Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) < TAP_SLOP
    ) {
      handleTap(e.clientX, e.clientY)
    }
  }

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
    debugDump("page-load-success") // TEMP DEBUG (Phase 1)
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
        // pan-x pan-y: one-finger scroll + momentum stay native; pinch is ours
        // (two-finger native scroll is suppressed by the touchmove blocker)
        style={{ touchAction: "pan-x pan-y" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
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
          <div ref={pageWrapRef} className="relative min-w-fit">
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
                onRenderSuccess={clearOverlay}
                onRenderError={clearOverlay}
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
