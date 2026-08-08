"use client"

import { useState } from "react"
import { FileUploader } from "@/components/upload/FileUploader"
import {
  CATEGORY_LABELS,
  UPLOAD_CATEGORIES,
  type UploadCategory,
} from "@/lib/files/categories"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const WHOLE_FLOOR = "__floor__"

export function FilesUploadPanel({
  floors,
  apartments,
}: {
  floors: { id: string; level: number; label: string }[]
  apartments: { id: string; name: string; floorId: string }[]
}) {
  const [category, setCategory] = useState<UploadCategory>("documentation")
  const [floorId, setFloorId] = useState<string>(floors[0]?.id ?? "")
  const [locationId, setLocationId] = useState<string>(WHOLE_FLOOR)

  const floorApartments = apartments.filter((a) => a.floorId === floorId)
  // XOR target (files_one_target): a chosen apartment wins over the floor
  const target =
    locationId !== WHOLE_FLOOR
      ? ({ locationId } as const)
      : ({ floorId } as const)

  if (floors.length === 0) return null

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Kategoria
          </label>
          {/* items maps value→label for SelectValue (Base UI renders the raw value otherwise) */}
          <Select
            value={category}
            onValueChange={(v) => { if (v) setCategory(v as UploadCategory) }}
            items={UPLOAD_CATEGORIES.map((cat) => ({
              value: cat,
              label: CATEGORY_LABELS[cat],
            }))}
          >
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UPLOAD_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Piętro
          </label>
          <Select
            value={floorId}
            onValueChange={(v) => {
              if (!v) return
              setFloorId(v)
              setLocationId(WHOLE_FLOOR)
            }}
            items={floors.map((f) => ({ value: f.id, label: f.label }))}
          >
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {floors.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Mieszkanie
          </label>
          <Select
            value={locationId}
            onValueChange={(v) => { if (v) setLocationId(v) }}
            items={[
              { value: WHOLE_FLOOR, label: "Całe piętro" },
              ...floorApartments.map((a) => ({ value: a.id, label: a.name })),
            ]}
          >
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={WHOLE_FLOOR}>Całe piętro</SelectItem>
              {floorApartments.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* key remounts the uploader so a mid-selection change can't mix targets */}
      <FileUploader
        key={`${category}-${floorId}-${locationId}`}
        category={category}
        {...target}
      />
    </div>
  )
}
