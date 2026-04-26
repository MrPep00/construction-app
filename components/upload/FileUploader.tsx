"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  CameraIcon,
  FolderOpenIcon,
  UploadIcon,
  XIcon,
  CheckIcon,
  AlertCircleIcon,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { uploadFile } from "@/lib/actions/files"

type ItemStatus = "pending" | "uploading" | "done" | "error"

type UploadItem = {
  id: string
  file: File
  previewUrl: string | null
  status: ItemStatus
}

function pluralize(n: number): string {
  if (n === 1) return "plik"
  if (n < 5) return "pliki"
  return "plików"
}

interface Props {
  locationId: string
}

export function FileUploader({ locationId }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<UploadItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)

  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Revoke all object URLs on unmount
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      items.forEach((i) => {
        if (i.previewUrl) URL.revokeObjectURL(i.previewUrl)
      })
    }
    // intentionally empty dep array — runs only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const newItems: UploadItem[] = Array.from(fileList).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      status: "pending" as const,
    }))
    setItems((prev) => [...prev, ...newItems])
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id)
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((i) => i.id !== id)
    })
  }, [])

  async function handleUpload() {
    const pendingItems = items.filter((i) => i.status === "pending")
    if (pendingItems.length === 0 || uploading) return

    setUploading(true)
    setItems((prev) =>
      prev.map((i) =>
        i.status === "pending" ? { ...i, status: "uploading" as const } : i
      )
    )

    const results = await Promise.all(
      pendingItems.map(async (item) => {
        const fd = new FormData()
        fd.append("file", item.file)
        fd.append("locationId", locationId)

        const result = await uploadFile(fd)

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: result.error ? ("error" as const) : ("done" as const) }
              : i
          )
        )

        return { name: item.file.name, error: result.error }
      })
    )

    const successes = results.filter((r) => !r.error)
    const failures = results.filter((r) => r.error)

    if (successes.length > 0) {
      const n = successes.length
      toast.success(`Wgrano ${n} ${pluralize(n)}`)
      router.refresh()
    }

    failures.forEach((r) => toast.error(`${r.name}: ${r.error}`))

    // Revoke object URLs and reset
    items.forEach((i) => {
      if (i.previewUrl) URL.revokeObjectURL(i.previewUrl)
    })
    if (cameraRef.current) cameraRef.current.value = ""
    if (fileRef.current) fileRef.current.value = ""
    setItems([])
    setUploading(false)
  }

  const pendingCount = items.filter((i) => i.status === "pending").length

  return (
    <div className="space-y-4">
      {/* Primary action buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={uploading}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CameraIcon className="size-4 shrink-0" />
          Zrób zdjęcie
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FolderOpenIcon className="size-4 shrink-0" />
          Wybierz plik
        </button>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files)
        }}
      />
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files)
        }}
      />

      {/* Drag-and-drop zone — desktop only */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragEnter={() => setDragging(true)}
        onDragLeave={(e) => {
          if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragging(false)
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
        }}
        className={cn(
          "hidden rounded-lg border-2 border-dashed p-6 transition-colors md:flex md:flex-col md:items-center md:gap-1",
          dragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/30 text-muted-foreground"
        )}
      >
        <UploadIcon className="size-6" />
        <p className="text-sm">Przeciągnij pliki tutaj</p>
        <p className="text-xs opacity-60">JPG, PNG, PDF, DWG, DOCX, XLSX · max 50 MB</p>
      </div>

      {/* Selected files preview + upload button */}
      {items.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {items.map((item) => (
              <div key={item.id} className="relative">
                <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                  {item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-1 p-2">
                      <FolderOpenIcon className="size-8 text-muted-foreground" />
                      <span className="line-clamp-2 text-center text-xs text-muted-foreground">
                        {item.file.name}
                      </span>
                    </div>
                  )}

                  {/* Status overlays */}
                  {item.status === "uploading" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <div className="size-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    </div>
                  )}
                  {item.status === "done" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <CheckIcon className="size-6 text-green-400" />
                    </div>
                  )}
                  {item.status === "error" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <AlertCircleIcon className="size-6 text-red-400" />
                    </div>
                  )}

                  {/* Remove button — only before upload starts */}
                  {item.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                      aria-label={`Usuń ${item.file.name} z kolejki`}
                    >
                      <XIcon className="size-3" />
                    </button>
                  )}
                </div>

                <p
                  className="mt-1 truncate text-xs text-muted-foreground"
                  title={item.file.name}
                >
                  {item.file.name}
                </p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || pendingCount === 0}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UploadIcon className="size-4" />
            {uploading
              ? "Wgrywanie..."
              : `Wgraj ${pendingCount} ${pluralize(pendingCount)}`}
          </button>
        </div>
      )}
    </div>
  )
}
