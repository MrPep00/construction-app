"use server"

import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"
import { createClient } from "@/lib/supabase/server"

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

const ALLOWED_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "heic", "heif",
  "pdf", "dwg", "dxf", "docx", "xlsx",
])

function isAllowedFile(name: string, mimeType: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  if (ALLOWED_EXTENSIONS.has(ext)) return true
  if (mimeType.startsWith("image/")) return true
  if (mimeType === "application/pdf") return true
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return true
  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return true
  if (mimeType === "application/octet-stream") return true
  return false
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 100)
}

async function resolveLocationPath(
  supabase: Awaited<ReturnType<typeof createClient>>,
  locationId: string
): Promise<string | null> {
  const { data: loc } = await supabase
    .from("locations")
    .select("floor_id")
    .eq("id", locationId)
    .single()
  if (!loc) return null

  const { data: floor } = await supabase
    .from("floors")
    .select("level, project_id")
    .eq("id", loc.floor_id)
    .single()
  if (!floor) return null

  return `/projects/${floor.project_id}/floors/${floor.level}/${locationId}`
}

export async function createUploadPath(
  locationId: string,
  filename: string,
  mimeType: string,
  sizeBytes: number,
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Nie zalogowany" }

  if (sizeBytes > MAX_FILE_SIZE) {
    return { error: `Plik "${filename}" jest za duży (max 50 MB)` }
  }
  if (!isAllowedFile(filename, mimeType)) {
    return { error: `Nieobsługiwany typ pliku: ${filename}` }
  }

  const uuid = randomUUID()
  const sanitized = sanitizeFilename(filename)
  const storagePath = `${user.id}/${locationId}/${uuid}-${sanitized}`

  const { data, error } = await supabase.storage
    .from("files")
    .createSignedUploadUrl(storagePath)

  if (error) return { error: error.message }

  return { data: { signedUrl: data.signedUrl, path: storagePath, token: data.token } }
}

export async function finalizeFileUpload(
  locationId: string,
  storagePath: string,
  filename: string,
  mimeType: string,
  sizeBytes: number,
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Nie zalogowany" }

  const { data, error: dbError } = await supabase
    .from("files")
    .insert({
      location_id: locationId,
      name: filename,
      storage_path: storagePath,
      mime_type: mimeType || "application/octet-stream",
      size_bytes: sizeBytes,
      uploaded_by: user.id,
    })
    .select()
    .single()

  if (dbError) {
    await supabase.storage.from("files").remove([storagePath])
    return { error: dbError.message }
  }

  const path = await resolveLocationPath(supabase, locationId)
  if (path) revalidatePath(path)

  return { data }
}

export async function uploadFile(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Nie zalogowany" }

  const file = formData.get("file")
  const locationId = formData.get("locationId")

  if (!(file instanceof File)) return { error: "Brak pliku" }
  if (typeof locationId !== "string" || !locationId) return { error: "Brak lokalizacji" }

  if (file.size > MAX_FILE_SIZE) {
    return { error: `Plik "${file.name}" jest za duży (max 50 MB)` }
  }
  if (!isAllowedFile(file.name, file.type)) {
    return { error: `Nieobsługiwany typ pliku: ${file.name}` }
  }

  const uuid = randomUUID()
  const sanitized = sanitizeFilename(file.name)
  const storagePath = `${user.id}/${locationId}/${uuid}-${sanitized}`

  const { error: uploadError } = await supabase.storage
    .from("files")
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
    })

  if (uploadError) return { error: uploadError.message }

  const { data, error: dbError } = await supabase
    .from("files")
    .insert({
      location_id: locationId,
      name: file.name,
      storage_path: storagePath,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      uploaded_by: user.id,
    })
    .select()
    .single()

  if (dbError) {
    await supabase.storage.from("files").remove([storagePath])
    return { error: dbError.message }
  }

  const path = await resolveLocationPath(supabase, locationId)
  if (path) revalidatePath(path)

  return { data }
}

export async function uploadIssuePhoto(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Nie zalogowany" }

  const file = formData.get("file")
  const locationId = formData.get("locationId")
  const issueId = formData.get("issueId")

  if (!(file instanceof File)) return { error: "Brak pliku" }
  if (typeof locationId !== "string" || !locationId) return { error: "Brak lokalizacji" }
  if (typeof issueId !== "string" || !issueId) return { error: "Brak ID usterki" }

  if (file.size > MAX_FILE_SIZE) return { error: `Plik "${file.name}" jest za duży (max 50 MB)` }
  if (!file.type.startsWith("image/")) return { error: "Tylko zdjęcia są dozwolone" }

  const uuid = randomUUID()
  const sanitized = sanitizeFilename(file.name)
  const storagePath = `${user.id}/${locationId}/${uuid}-${sanitized}`

  const { error: uploadError } = await supabase.storage
    .from("files")
    .upload(storagePath, file, { contentType: file.type })

  if (uploadError) return { error: uploadError.message }

  const { data, error: dbError } = await supabase
    .from("files")
    .insert({
      location_id: locationId,
      issue_id: issueId,
      name: file.name,
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: user.id,
    })
    .select("id")
    .single()

  if (dbError) {
    await supabase.storage.from("files").remove([storagePath])
    return { error: dbError.message }
  }

  return { data }
}

export async function deleteFile(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Nie zalogowany" }

  const { data: file } = await supabase
    .from("files")
    .select("id, storage_path, location_id")
    .eq("id", id)
    .single()

  if (!file) return { error: "Plik nie znaleziony" }

  // Best-effort storage deletion — proceed to DB cleanup even if it fails
  await supabase.storage.from("files").remove([file.storage_path])

  const { error: dbError } = await supabase.from("files").delete().eq("id", id)
  if (dbError) return { error: dbError.message }

  const path = await resolveLocationPath(supabase, file.location_id)
  if (path) revalidatePath(path)

  return { data: true }
}
