"use client"

import { FileUploader } from "./FileUploader"
import { FileGridClient, type FileItem } from "./FileGridClient"

interface Props {
  floorId: string
  files: FileItem[]
}

export function FloorFilePanel({ floorId, files }: Props) {
  return (
    <div className="rounded-xl border bg-card lg:sticky lg:top-[calc(3.5rem+1px)] lg:max-h-[calc(100vh-3.5rem-2rem)] lg:overflow-y-auto">
      <div className="flex items-center border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Pliki piętra</h2>
      </div>
      <div className="space-y-4 p-4">
        <FileUploader floorId={floorId} />
        {files.length > 0 ? (
          <FileGridClient
            files={files}
            className="grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2"
          />
        ) : (
          <p className="text-xs text-muted-foreground">Brak plików</p>
        )}
      </div>
    </div>
  )
}
