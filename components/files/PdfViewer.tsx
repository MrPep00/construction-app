"use client"

import { useEffect, useRef, useState, useCallback } from "react"
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
  DownloadIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface Props {
  src: string
  filename: string
  onClose: () => void
}

export function PdfViewer({ src, filename, onClose }: Props) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1)
  const [fitWidth, setFitWidth] = useState(true)
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined)
  const [loadError, setLoadError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const numPagesRef = useRef<number | null>(null)
  const pageNumberRef = useRef(pageNumber)
  const scaleRef = useRef(scale)
  const fitWidthRef = useRef(fitWidth)

  useEffect(() => { pageNumberRef.current = pageNumber }, [pageNumber])
  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { fitWidthRef.current = fitWidth }, [fitWidth])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setContainerWidth(el.clientWidth - 32)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const goToPrev = useCallback(() => {
    setPageNumber((p) => Math.max(1, p - 1))
  }, [])

  const goToNext = useCallback(() => {
    setPageNumber((p) => Math.min(numPagesRef.current ?? p, p + 1))
  }, [])

  const zoomIn = useCallback(() => {
    setFitWidth(false)
    setScale((s) => Math.min(3, parseFloat((s + 0.25).toFixed(2))))
  }, [])

  const zoomOut = useCallback(() => {
    setFitWidth(false)
    setScale((s) => Math.max(0.25, parseFloat((s - 0.25).toFixed(2))))
  }, [])

  const toggleFitWidth = useCallback(() => {
    setFitWidth((f) => !f)
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") goToPrev()
      if (e.key === "ArrowRight") goToNext()
      if (e.key === "+" || e.key === "=") zoomIn()
      if (e.key === "-") zoomOut()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose, goToPrev, goToNext, zoomIn, zoomOut])

  function handleLoadSuccess({ numPages: n }: { numPages: number }) {
    setNumPages(n)
    numPagesRef.current = n
    setLoadError(false)
  }

  const pageProps = fitWidth && containerWidth
    ? { width: containerWidth }
    : { scale }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      {/* Header — filename only; X button is portalled to body so nothing can clip it */}
      <div className="flex shrink-0 items-center border-b bg-background px-4 py-2 pr-16">
        <h2 className="truncate text-sm font-medium">
          {filename}
        </h2>
      </div>

      {/* Close button — rendered directly into document.body, immune to all stacking contexts */}
      {typeof document !== "undefined" && createPortal(
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij podgląd"
          style={{ position: "fixed", top: 0, right: 0, zIndex: 9999 }}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-bl-md bg-background hover:bg-muted border-b border-l"
        >
          <XIcon className="size-5" />
        </button>,
        document.body
      )}

      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b bg-muted/40 px-3 py-1.5">
        {/* Page nav */}
        <button
          type="button"
          onClick={goToPrev}
          disabled={pageNumber <= 1}
          aria-label="Poprzednia strona"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md px-2 hover:bg-muted disabled:opacity-40 md:min-h-0 md:min-w-0"
        >
          <ChevronLeftIcon className="size-4" />
          <span className="sr-only md:not-sr-only md:text-xs">Poprzednia</span>
        </button>

        <span className="whitespace-nowrap px-1 text-xs text-muted-foreground">
          Strona {pageNumber} z {numPages ?? "…"}
        </span>

        <button
          type="button"
          onClick={goToNext}
          disabled={pageNumber >= (numPages ?? 1)}
          aria-label="Następna strona"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md px-2 hover:bg-muted disabled:opacity-40 md:min-h-0 md:min-w-0"
        >
          <span className="sr-only md:not-sr-only md:text-xs">Następna</span>
          <ChevronRightIcon className="size-4" />
        </button>

        <div className="mx-1 h-4 w-px bg-border" />

        {/* Zoom */}
        <button
          type="button"
          onClick={zoomOut}
          aria-label="Pomniejsz"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md hover:bg-muted md:min-h-0 md:min-w-0 md:px-2"
        >
          <MinusIcon className="size-4" />
        </button>

        <span className={cn("min-w-[3.5rem] text-center text-xs", fitWidth && "text-muted-foreground")}>
          {fitWidth ? "Szer." : `${Math.round(scale * 100)}%`}
        </span>

        <button
          type="button"
          onClick={zoomIn}
          aria-label="Powiększ"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md hover:bg-muted md:min-h-0 md:min-w-0 md:px-2"
        >
          <PlusIcon className="size-4" />
        </button>

        <button
          type="button"
          onClick={toggleFitWidth}
          aria-label="Dopasuj do szerokości"
          className={cn(
            "flex min-h-[44px] items-center gap-1 rounded-md px-2 text-xs hover:bg-muted md:min-h-0",
            fitWidth && "bg-muted font-medium"
          )}
        >
          <MaximizeIcon className="size-3.5" />
          <span className="hidden sm:inline">Dopasuj do szerokości</span>
        </button>

        <div className="mx-1 h-4 w-px bg-border" />

        {/* Download */}
        <a
          href={src}
          download={filename}
          aria-label="Pobierz plik"
          className="flex min-h-[44px] items-center gap-1 rounded-md px-2 text-xs hover:bg-muted md:min-h-0"
        >
          <DownloadIcon className="size-3.5" />
          <span className="hidden sm:inline">Pobierz</span>
        </a>
      </div>

      {/* Document body — only this scrolls; header + toolbar stay fixed */}
      {/* min-h-0 required in Safari: flex items default min-height:auto which breaks overflow scroll */}
      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-auto p-4"
      >
        {/* Inner wrapper: centers narrow PDFs, expands for wide ones so horizontal scroll works */}
        <div className="flex min-w-fit justify-center">
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
            <Document
              file={src}
              onLoadSuccess={handleLoadSuccess}
              onLoadError={() => setLoadError(true)}
              loading={
                <p className="pt-16 text-sm text-muted-foreground">
                  Ładowanie dokumentu…
                </p>
              }
            >
              <Page
                pageNumber={pageNumber}
                {...pageProps}
                loading={
                  <div className="flex h-[60vh] items-center justify-center">
                    <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                }
              />
            </Document>
          )}
        </div>
      </div>
    </div>
  )
}
