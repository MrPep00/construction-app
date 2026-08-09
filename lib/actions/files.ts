"use server"

import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"
import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logging/log-error"
import { getR2PresignedPutUrl, uploadToR2, deleteFromR2, isR2Configured } from "@/lib/storage/r2"
import { deleteStoredObject } from "@/lib/storage"
import { isUploadCategory } from "@/lib/files/categories"

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
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 200)
}

async function getTeamId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId)
    .single()
  if (!data?.team_id) {
    throw new Error(`User ${userId} has no team membership`)
  }
  return data.team_id
}

// project_id is NOT NULL on files (migration 022) — every insert resolves it
// server-side from the chosen target, so it can never diverge from the target.

async function resolveLocationContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  locationId: string
): Promise<{ path: string; projectId: string } | null> {
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

  return {
    path: `/projects/${floor.project_id}/floors/${floor.level}/${locationId}`,
    projectId: floor.project_id,
  }
}

async function resolveFloorContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  floorId: string
): Promise<{ path: string; projectId: string } | null> {
  const { data: floor } = await supabase
    .from("floors")
    .select("level, project_id")
    .eq("id", floorId)
    .single()
  if (!floor) return null
  return {
    path: `/projects/${floor.project_id}/floors/${floor.level}`,
    projectId: floor.project_id,
  }
}

async function resolveTaskProjectId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string
): Promise<string | null> {
  const { data: task } = await supabase
    .from("tasks")
    .select("project_id")
    .eq("id", taskId)
    .single()
  return task?.project_id ?? null
}

// ─── Two-step upload (client-direct-to-R2) ───────────────────────────────────
// Step 1: get presigned PUT URL. Step 2: client PUTs file. Step 3: finalize DB row.

export async function createUploadPath(
  locationId: string,
  filename: string,
  mimeType: string,
  sizeBytes: number,
) {
  try {
    if (!isR2Configured()) return { error: "Magazyn plików nie jest skonfigurowany — skontaktuj się z administratorem" }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    if (sizeBytes > MAX_FILE_SIZE) return { error: `Plik "${filename}" jest za duży (max 50 MB)` }
    if (!isAllowedFile(filename, mimeType)) return { error: `Nieobsługiwany typ pliku: ${filename}` }

    const teamId = await getTeamId(supabase, user.id)
    const uuid = randomUUID()
    const sanitized = sanitizeFilename(filename)
    const storagePath = `${teamId}/${locationId}/${uuid}-${sanitized}`

    const signedUrl = await getR2PresignedPutUrl(storagePath, mimeType || "application/octet-stream")

    return { data: { signedUrl, path: storagePath } }
  } catch (error) {
    await logError({ error, actionName: "createUploadPath", context: { locationId } })
    return { error: "Nie udało się przygotować uploadu" }
  }
}

export async function createUploadPathForFloor(
  floorId: string,
  filename: string,
  mimeType: string,
  sizeBytes: number,
) {
  try {
    if (!isR2Configured()) return { error: "Magazyn plików nie jest skonfigurowany — skontaktuj się z administratorem" }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    if (sizeBytes > MAX_FILE_SIZE) return { error: `Plik "${filename}" jest za duży (max 50 MB)` }
    if (!isAllowedFile(filename, mimeType)) return { error: `Nieobsługiwany typ pliku: ${filename}` }

    const teamId = await getTeamId(supabase, user.id)
    const uuid = randomUUID()
    const sanitized = sanitizeFilename(filename)
    const storagePath = `${teamId}/floors/${floorId}/${uuid}-${sanitized}`

    const signedUrl = await getR2PresignedPutUrl(storagePath, mimeType || "application/octet-stream")

    return { data: { signedUrl, path: storagePath } }
  } catch (error) {
    await logError({ error, actionName: "createUploadPathForFloor", context: { floorId } })
    return { error: "Nie udało się przygotować uploadu" }
  }
}

export async function finalizeFileUpload(
  locationId: string,
  storagePath: string,
  filename: string,
  mimeType: string,
  sizeBytes: number,
  category?: string,
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    const ctx = await resolveLocationContext(supabase, locationId)
    if (!ctx) {
      await deleteFromR2(storagePath).catch(() => {})
      return { error: "Lokalizacja nie istnieje" }
    }

    const { data, error: dbError } = await supabase
      .from("files")
      .insert({
        project_id: ctx.projectId,
        location_id: locationId,
        name: filename,
        storage_path: storagePath,
        mime_type: mimeType || "application/octet-stream",
        size_bytes: sizeBytes,
        uploaded_by: user.id,
        storage_provider: "r2",
        // Invalid/absent category falls back to DB default 'documentation'
        ...(isUploadCategory(category) ? { category } : {}),
      })
      .select()
      .single()

    if (dbError) {
      await deleteFromR2(storagePath).catch(() => {})
      return { error: dbError.message }
    }

    revalidatePath(ctx.path)

    return { data }
  } catch (error) {
    await logError({ error, actionName: "finalizeFileUpload", context: { locationId } })
    return { error: "Nie udało się zapisać pliku" }
  }
}

export async function finalizeFileUploadForFloor(
  floorId: string,
  storagePath: string,
  filename: string,
  mimeType: string,
  sizeBytes: number,
  category?: string,
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    const ctx = await resolveFloorContext(supabase, floorId)
    if (!ctx) {
      await deleteFromR2(storagePath).catch(() => {})
      return { error: "Piętro nie istnieje" }
    }

    const { data, error: dbError } = await supabase
      .from("files")
      .insert({
        project_id: ctx.projectId,
        floor_id: floorId,
        name: filename,
        storage_path: storagePath,
        mime_type: mimeType || "application/octet-stream",
        size_bytes: sizeBytes,
        uploaded_by: user.id,
        storage_provider: "r2",
        // Invalid/absent category falls back to DB default 'documentation'
        ...(isUploadCategory(category) ? { category } : {}),
      })
      .select()
      .single()

    if (dbError) {
      await deleteFromR2(storagePath).catch(() => {})
      return { error: dbError.message }
    }

    revalidatePath(ctx.path)

    return { data }
  } catch (error) {
    await logError({ error, actionName: "finalizeFileUploadForFloor", context: { floorId } })
    return { error: "Nie udało się zapisać pliku" }
  }
}

// Project-level file: no floor/location/task target (all NULL — migration 022).
// Shows only in the project-wide Pliki tab.
export async function createUploadPathForProject(
  projectId: string,
  filename: string,
  mimeType: string,
  sizeBytes: number,
) {
  try {
    if (!isR2Configured()) return { error: "Magazyn plików nie jest skonfigurowany — skontaktuj się z administratorem" }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    if (sizeBytes > MAX_FILE_SIZE) return { error: `Plik "${filename}" jest za duży (max 50 MB)` }
    if (!isAllowedFile(filename, mimeType)) return { error: `Nieobsługiwany typ pliku: ${filename}` }

    const teamId = await getTeamId(supabase, user.id)
    const uuid = randomUUID()
    const sanitized = sanitizeFilename(filename)
    const storagePath = `${teamId}/projects/${projectId}/${uuid}-${sanitized}`

    const signedUrl = await getR2PresignedPutUrl(storagePath, mimeType || "application/octet-stream")

    return { data: { signedUrl, path: storagePath } }
  } catch (error) {
    await logError({ error, actionName: "createUploadPathForProject", context: { projectId } })
    return { error: "Nie udało się przygotować uploadu" }
  }
}

export async function finalizeFileUploadForProject(
  projectId: string,
  storagePath: string,
  filename: string,
  mimeType: string,
  sizeBytes: number,
  category?: string,
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    const { data, error: dbError } = await supabase
      .from("files")
      .insert({
        project_id: projectId,
        name: filename,
        storage_path: storagePath,
        mime_type: mimeType || "application/octet-stream",
        size_bytes: sizeBytes,
        uploaded_by: user.id,
        storage_provider: "r2",
        // Invalid/absent category falls back to DB default 'documentation'
        ...(isUploadCategory(category) ? { category } : {}),
      })
      .select()
      .single()

    if (dbError) {
      await deleteFromR2(storagePath).catch(() => {})
      return { error: dbError.message }
    }

    revalidatePath(`/projects/${projectId}/files`)

    return { data }
  } catch (error) {
    await logError({ error, actionName: "finalizeFileUploadForProject", context: { projectId } })
    return { error: "Nie udało się zapisać pliku" }
  }
}

// ─── Server-side full upload (FormData → R2) ─────────────────────────────────

export async function uploadFile(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    const file = formData.get("file")
    const locationId = formData.get("locationId")

    if (!(file instanceof File)) return { error: "Brak pliku" }
    if (typeof locationId !== "string" || !locationId) return { error: "Brak lokalizacji" }

    if (file.size > MAX_FILE_SIZE) return { error: `Plik "${file.name}" jest za duży (max 50 MB)` }
    if (!isAllowedFile(file.name, file.type)) return { error: `Nieobsługiwany typ pliku: ${file.name}` }

    const ctx = await resolveLocationContext(supabase, locationId)
    if (!ctx) return { error: "Lokalizacja nie istnieje" }

    const teamId = await getTeamId(supabase, user.id)
    const uuid = randomUUID()
    const sanitized = sanitizeFilename(file.name)
    const storagePath = `${teamId}/${locationId}/${uuid}-${sanitized}`
    const mimeType = file.type || "application/octet-stream"

    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadToR2(storagePath, buffer, mimeType)

    const { data, error: dbError } = await supabase
      .from("files")
      .insert({
        project_id: ctx.projectId,
        location_id: locationId,
        name: file.name,
        storage_path: storagePath,
        mime_type: mimeType,
        size_bytes: file.size,
        uploaded_by: user.id,
        storage_provider: "r2",
      })
      .select()
      .single()

    if (dbError) {
      await deleteFromR2(storagePath).catch(() => {})
      return { error: dbError.message }
    }

    revalidatePath(ctx.path)

    return { data }
  } catch (error) {
    await logError({ error, actionName: "uploadFile" })
    return { error: "Nie udało się wgrać pliku" }
  }
}

export async function uploadIssuePhoto(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    const file = formData.get("file")
    const locationId = formData.get("locationId")
    const issueId = formData.get("issueId")

    if (!(file instanceof File)) return { error: "Brak pliku" }
    if (typeof locationId !== "string" || !locationId) return { error: "Brak lokalizacji" }
    if (typeof issueId !== "string" || !issueId) return { error: "Brak ID usterki" }

    if (file.size > MAX_FILE_SIZE) return { error: `Plik "${file.name}" jest za duży (max 50 MB)` }
    if (!file.type.startsWith("image/")) return { error: "Tylko zdjęcia są dozwolone" }

    const ctx = await resolveLocationContext(supabase, locationId)
    if (!ctx) return { error: "Lokalizacja nie istnieje" }

    const teamId = await getTeamId(supabase, user.id)
    const uuid = randomUUID()
    const sanitized = sanitizeFilename(file.name)
    const storagePath = `${teamId}/${locationId}/${uuid}-${sanitized}`
    const mimeType = file.type

    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadToR2(storagePath, buffer, mimeType)

    const { data, error: dbError } = await supabase
      .from("files")
      .insert({
        project_id: ctx.projectId,
        location_id: locationId,
        issue_id: issueId,
        category: "issue_photo",
        name: file.name,
        storage_path: storagePath,
        mime_type: mimeType,
        size_bytes: file.size,
        uploaded_by: user.id,
        storage_provider: "r2",
      })
      .select("id")
      .single()

    if (dbError) {
      await deleteFromR2(storagePath).catch(() => {})
      return { error: dbError.message }
    }

    return { data }
  } catch (error) {
    await logError({ error, actionName: "uploadIssuePhoto" })
    return { error: "Nie udało się wgrać zdjęcia" }
  }
}

export async function uploadFileForTask(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    const file = formData.get("file")
    const taskId = formData.get("taskId")

    if (!(file instanceof File)) return { error: "Brak pliku" }
    if (typeof taskId !== "string" || !taskId) return { error: "Brak ID zadania" }

    if (file.size > MAX_FILE_SIZE) return { error: `Plik "${file.name}" jest za duży (max 50 MB)` }
    if (!isAllowedFile(file.name, file.type)) return { error: `Nieobsługiwany typ pliku: ${file.name}` }

    const projectId = await resolveTaskProjectId(supabase, taskId)
    if (!projectId) return { error: "Zadanie nie istnieje" }

    const teamId = await getTeamId(supabase, user.id)
    const uuid = randomUUID()
    const sanitized = sanitizeFilename(file.name)
    const storagePath = `${teamId}/tasks/${taskId}/${uuid}-${sanitized}`
    const mimeType = file.type || "application/octet-stream"

    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadToR2(storagePath, buffer, mimeType)

    const { data, error: dbError } = await supabase
      .from("files")
      .insert({
        project_id: projectId,
        task_id: taskId,
        category: "task_file",
        name: file.name,
        storage_path: storagePath,
        mime_type: mimeType,
        size_bytes: file.size,
        uploaded_by: user.id,
        storage_provider: "r2",
      })
      .select("id")
      .single()

    if (dbError) {
      await deleteFromR2(storagePath).catch(() => {})
      return { error: dbError.message }
    }

    return { data }
  } catch (error) {
    await logError({ error, actionName: "uploadFileForTask" })
    return { error: "Nie udało się wgrać pliku" }
  }
}

// ─── Delete (provider-aware) ──────────────────────────────────────────────────

export async function deleteFile(id: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Nie zalogowany" }

    const { data: file } = await supabase
      .from("files")
      .select("id, storage_path, storage_provider, project_id, location_id, floor_id, task_id")
      .eq("id", id)
      .single()

    if (!file) return { error: "Plik nie znaleziony" }

    // Best-effort storage deletion — proceed to DB cleanup even on failure
    await deleteStoredObject(file, supabase)

    const { error: dbError } = await supabase.from("files").delete().eq("id", id)
    if (dbError) return { error: dbError.message }

    if (file.location_id) {
      const ctx = await resolveLocationContext(supabase, file.location_id)
      if (ctx) revalidatePath(ctx.path)
    } else if (file.floor_id) {
      const ctx = await resolveFloorContext(supabase, file.floor_id)
      if (ctx) revalidatePath(ctx.path)
    }
    // Covers project-level (target-less) files and keeps Pliki tab counts fresh
    revalidatePath(`/projects/${file.project_id}/files`)

    return { data: true }
  } catch (error) {
    await logError({ error, actionName: "deleteFile", context: { fileId: id } })
    return { error: "Nie udało się usunąć pliku" }
  }
}
