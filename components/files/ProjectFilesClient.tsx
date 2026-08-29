"use client"

import { useState, useTransition } from "react"
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
  Trash2Icon,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Lightbox } from "@/components/upload/Lightbox"
import { deleteFile } from "@/lib/actions/files"
import { isPdf } from "@/lib/files/is-pdf"
import {
  CATEGORY_LABELS,
  VISIBLE_CATEGORIES,
  type VisibleCategory,
} from "@/lib/files/categories"
import { formatTimestampPl } from "@/lib/dates"

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
  return formatTimestampPl(new Date(dateStr), {
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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [pdfFile, setPdfFile] = useState<ProjectFileRow | null>(null)
  // Optimistically removed rows; stale ids are harmless after router.refresh
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleDelete(row: ProjectFileRow) {
    if (!confirm(`Usunąć plik "${row.name}"? Tej operacji nie można cofnąć.`)) return
    // Deleting shifts gallery indices, so close the viewer rather than let it
    // point at the wrong photo.
    if (lightboxIndex !== null && row.mimeType.startsWith("image/")) {
      setLightboxIndex(null)
    }
    if (pdfFile?.id === row.id) setPdfFile(null)
    setDeletingId(row.id)
    setDeletedIds((prev) => new Set(prev).add(row.id))

    startTransition(async () => {
      const result = await deleteFile(row.id)
      setDeletingId(null)
      if (result.error) {
        // Rollback: restore the row, surface the server error verbatim
        setDeletedIds((prev) => {
          const copy = new Set(prev)
          copy.delete(row.id)
          return copy
        })
        toast.error(result.error)
      } else {
        toast.success("Plik usunięty")
        // Resync rail counts + "Wszystkie"
        router.refresh()
      }
    })
  }

  const visibleRows = rows.filter((row) => !deletedIds.has(row.id))
  // Gallery = exactly the images the user currently sees (server-side category
  // filter already applied to `rows`), in on-screen order. PDFs and other files
  // are skipped, so prev/next never lands on something the Lightbox can't show.
  const galleryImages = visibleRows.filter(
    (row) => row.mimeType.startsWith("image/") && row.url
  )

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
    if (row.mimeType.startsWith("image/")) {
      setLightboxIndex(galleryImages.findIndex((r) => r.id === row.id))
    }
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
        {visibleRows.length === 0 ? (
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
                    <th className="w-12 px-2 py-3">
                      <span className="sr-only">Akcje</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
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
                      <td className="px-2 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="tap-target"
                          title="Usuń plik"
                          aria-label={`Usuń ${row.name}`}
                          disabled={deletingId === row.id}
                          onClick={() => handleDelete(row)}
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: list */}
            <ul className="flex flex-col gap-2 md:hidden">
              {visibleRows.map((row) => {
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
                  <li
                    key={row.id}
                    className="flex items-center gap-1 rounded-xl border bg-card p-3"
                  >
                    {isDownload(row) ? (
                      <a
                        href={row.url ?? "#"}
                        download={row.name}
                        className="flex min-h-11 min-w-0 flex-1 items-center gap-3"
                      >
                        {inner}
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openFile(row)}
                        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        {inner}
                      </button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="tap-target shrink-0"
                      title="Usuń plik"
                      aria-label={`Usuń ${row.name}`}
                      disabled={deletingId === row.id}
                      onClick={() => handleDelete(row)}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
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

      {lightboxIndex !== null && galleryImages.length > 0 && (
        <Lightbox
          images={galleryImages.map((row) => ({
            src: row.url as string,
            filename: row.name,
            uploadedAt: row.createdAt,
          }))}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
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
