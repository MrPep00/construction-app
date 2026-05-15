"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  FileTextIcon,
  FileIcon,
  FileSpreadsheetIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Lightbox } from "./Lightbox"
import { deleteFile } from "@/lib/actions/files"

export type FileItem = {
  id: string
  name: string
  mime_type: string
  size_bytes: number
  created_at: string
  storage_path: string
  storage_provider: string
  signedUrl: string | null
}

function NonImageIcon({ mimeType, name }: { mimeType: string; name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  if (mimeType === "application/pdf" || ext === "pdf") {
    return <FileTextIcon className="size-10 text-red-500" />
  }
  if (ext === "xlsx" || mimeType.includes("spreadsheet")) {
    return <FileSpreadsheetIcon className="size-10 text-green-600" />
  }
  return <FileIcon className="size-10 text-muted-foreground" />
}

interface Props {
  files: FileItem[]
  className?: string
}

export function FileGridClient({ files, className }: Props) {
  const router = useRouter()
  const [lightbox, setLightbox] = useState<FileItem | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleDelete(file: FileItem) {
    if (!confirm(`Usunąć plik "${file.name}"? Tej operacji nie można cofnąć.`)) return
    if (lightbox?.id === file.id) setLightbox(null)
    setDeletingId(file.id)

    startTransition(async () => {
      const result = await deleteFile(file.id)
      setDeletingId(null)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Plik usunięty")
        router.refresh()
      }
    })
  }

  if (files.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Brak plików w tej lokalizacji.
      </p>
    )
  }

  return (
    <>
      <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6", className)}>
        {files.map((file) => {
          const isImage = file.mime_type.startsWith("image/")
          const isDeleting = deletingId === file.id

          return (
            <div key={file.id} className="group">
              <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                {isImage && file.signedUrl ? (
                  <button
                    type="button"
                    className="size-full"
                    onClick={() => setLightbox(file)}
                    aria-label={`Podgląd: ${file.name}`}
                  >
                    <Image
                      src={file.signedUrl}
                      alt={file.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                    />
                  </button>
                ) : (
                  <a
                    href={file.signedUrl ?? "#"}
                    download={file.name}
                    className="flex size-full flex-col items-center justify-center gap-2 p-2 hover:bg-muted/80"
                    aria-label={`Pobierz: ${file.name}`}
                  >
                    <NonImageIcon mimeType={file.mime_type} name={file.name} />
                  </a>
                )}

                {/* Deleting overlay */}
                {isDeleting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  </div>
                )}

                {/* Delete button — visible on hover/focus */}
                <button
                  type="button"
                  onClick={() => handleDelete(file)}
                  disabled={isDeleting}
                  className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Usuń ${file.name}`}
                >
                  <Trash2Icon className="size-3.5" />
                </button>
              </div>

              <p
                className="mt-1 truncate text-xs text-muted-foreground"
                title={file.name}
              >
                {file.name}
              </p>
            </div>
          )
        })}
      </div>

      {lightbox && lightbox.signedUrl && (
        <Lightbox
          src={lightbox.signedUrl}
          filename={lightbox.name}
          uploadedAt={lightbox.created_at}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  )
}
