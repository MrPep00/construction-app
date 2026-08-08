"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import Image from "next/image"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  CameraIcon,
  ClipboardCheckIcon,
  FileIcon,
  FileTextIcon,
  FolderIcon,
  PencilRulerIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Lightbox } from "@/components/upload/Lightbox"
import { isPdf } from "@/lib/files/is-pdf"
import {
  CATEGORY_LABELS,
  VISIBLE_CATEGORIES,
  type VisibleCategory,
} from "@/lib/files/categories"

const PdfViewer = dynamic(
  () => import("@/components/files/PdfViewer").then((m) => m.PdfViewer),
  { ssr: false }
)

export type ProjectFileRow = {
  id: string
  name: string
  mimeType: string
  sizeBytes: number
  createdAt: string
  category: string
  /** "P3 · M31" | "Dach" | "—" */
  floorLabel: string
  url: string | null
}

const CATEGORY_ICONS: Record<VisibleCategory, LucideIcon> = {
  drawing: PencilRulerIcon,
  protocol: ClipboardCheckIcon,
  documentation: FileTextIcon,
  issue_photo: CameraIcon,
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function FileThumb({ row, size }: { row: ProjectFileRow; size: number }) {
  const isImage = row.mimeType.startsWith("image/")
  if (isImage && row.url) {
    return (
      <span
        className="relative shrink-0 overflow-hidden rounded-lg border bg-muted"
        style={{ width: size, height: size }}
      >
        <Image src={row.url} alt="" fill className="object-cover" sizes={`${size}px`} />
      </span>
    )
  }
  const Icon = isPdf({ mime_type: row.mimeType, name: row.name })
    ? FileTextIcon
    : FileIcon
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground"
      style={{ width: size, height: size }}
    >
      <Icon className="size-5" />
    </span>
  )
}

export function ProjectFilesClient({
  rows,
  counts,
  total,
  active,
  hasMore,
  limit,
}: {
  rows: ProjectFileRow[]
  counts: Record<VisibleCategory, number>
  /** Distinct file count — the Zdjęcia union overlaps other categories, so
   *  summing per-category counts would double-count image files */
  total: number
  active: VisibleCategory | null
  hasMore: boolean
  limit: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [lightbox, setLightbox] = useState<ProjectFileRow | null>(null)
  const [pdfFile, setPdfFile] = useState<ProjectFileRow | null>(null)

  function setCategory(next: VisibleCategory | null) {
    // Category change resets pagination (limit param intentionally dropped)
    const params = new URLSearchParams(searchParams)
    params.delete("limit")
    if (next) params.set("category", next)
    else params.delete("category")
    router.replace(params.size > 0 ? `${pathname}?${params}` : pathname, {
      scroll: false,
    })
  }

  function showMore() {
    const params = new URLSearchParams(searchParams)
    params.set("limit", String(limit + 200))
    router.replace(`${pathname}?${params}`, { scroll: false })
  }

  function openFile(row: ProjectFileRow) {
    if (!row.url) return
    if (row.mimeType.startsWith("image/")) setLightbox(row)
    else if (isPdf({ mime_type: row.mimeType, name: row.name })) setPdfFile(row)
  }

  const isDownload = (row: ProjectFileRow) =>
    !row.mimeType.startsWith("image/") &&
    !isPdf({ mime_type: row.mimeType, name: row.name })

  const emptyLabel = active
    ? `Brak plików w kategorii „${CATEGORY_LABELS[active]}”.`
    : "Brak plików w tym projekcie."

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      {/* Desktop: category rail */}
      <aside className="hidden w-56 shrink-0 flex-col gap-1 md:flex">
        <RailItem
          icon={FolderIcon}
          label="Wszystkie pliki"
          count={total}
          active={active === null}
          onClick={() => setCategory(null)}
        />
        {VISIBLE_CATEGORIES.map((cat) => (
          <RailItem
            key={cat}
            icon={CATEGORY_ICONS[cat]}
            label={CATEGORY_LABELS[cat]}
            count={counts[cat]}
            active={active === cat}
            onClick={() => setCategory(cat)}
          />
        ))}
      </aside>

      {/* Mobile: 2x2 category tiles (tap active tile to clear) */}
      <div className="grid grid-cols-2 gap-2 md:hidden">
        {VISIBLE_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat]
          const isActive = active === cat
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(isActive ? null : cat)}
              aria-pressed={isActive}
              className={cn(
                "flex min-h-[72px] flex-col items-start justify-between rounded-xl border p-3 text-left transition-colors",
                isActive
                  ? "border-brand bg-brand-soft text-brand"
                  : "bg-card hover:bg-muted"
              )}
            >
              <Icon className="size-5" />
              <span className="w-full">
                <span className="block truncate text-sm font-medium">
                  {CATEGORY_LABELS[cat]}
                </span>
                <span
                  className={cn(
                    "text-xs",
                    isActive ? "text-brand/80" : "text-muted-foreground"
                  )}
                >
                  {counts[cat]}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="min-w-0 flex-1">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <>
            {/* Desktop: table */}
            <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Nazwa</th>
                    <th className="w-36 px-4 py-3 font-medium">Piętro</th>
                    <th className="w-24 px-4 py-3 font-medium">Rozmiar</th>
                    <th className="w-32 px-4 py-3 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b last:border-b-0 hover:bg-muted/50">
                      <td className="px-4 py-2">
                        {isDownload(row) ? (
                          <a
                            href={row.url ?? "#"}
                            download={row.name}
                            className="flex min-h-11 items-center gap-3"
                          >
                            <FileThumb row={row} size={40} />
                            <span className="truncate" title={row.name}>{row.name}</span>
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openFile(row)}
                            className="flex min-h-11 w-full items-center gap-3 text-left"
                          >
                            <FileThumb row={row} size={40} />
                            <span className="truncate" title={row.name}>{row.name}</span>
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{row.floorLabel}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {formatBytes(row.sizeBytes)}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {formatDate(row.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: list */}
            <ul className="flex flex-col gap-2 md:hidden">
              {rows.map((row) => {
                const meta = `${row.floorLabel} · ${formatBytes(row.sizeBytes)} · ${formatDate(row.createdAt)}`
                const inner = (
                  <>
                    <FileThumb row={row} size={48} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{row.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {meta}
                      </span>
                    </span>
                  </>
                )
                return (
                  <li key={row.id}>
                    {isDownload(row) ? (
                      <a
                        href={row.url ?? "#"}
                        download={row.name}
                        className="flex min-h-11 items-center gap-3 rounded-xl border bg-card p-3"
                      >
                        {inner}
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openFile(row)}
                        className="flex min-h-11 w-full items-center gap-3 rounded-xl border bg-card p-3 text-left"
                      >
                        {inner}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>

            {hasMore && (
              <div className="mt-4 flex justify-center">
                <Button type="button" variant="outline" onClick={showMore}>
                  Pokaż więcej
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {lightbox && lightbox.url && (
        <Lightbox
          src={lightbox.url}
          filename={lightbox.name}
          uploadedAt={lightbox.createdAt}
          onClose={() => setLightbox(null)}
        />
      )}

      {pdfFile && pdfFile.url && (
        <PdfViewer
          src={pdfFile.url}
          filename={pdfFile.name}
          onClose={() => setPdfFile(null)}
        />
      )}
    </div>
  )
}

function RailItem({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: LucideIcon
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
        active
          ? "bg-brand-soft font-medium text-brand"
          : "text-foreground hover:bg-muted"
      )}
    >
      <Icon className="size-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      <span
        className={cn(
          "text-xs tabular-nums",
          active ? "text-brand/80" : "text-muted-foreground"
        )}
      >
        {count}
      </span>
    </button>
  )
}
