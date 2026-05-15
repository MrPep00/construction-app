/**
 * Unified file URL resolver. Branches on storage_provider.
 * Used by Server Components that display files from the `files` table.
 *
 * Handles both legacy Supabase files (storage_provider='supabase') and
 * current R2 files (storage_provider='r2') in a single batched call.
 */

import { getR2SignedUrl, getR2PublicUrl, isR2Configured } from "./r2"
import type { SupabaseClient } from "@supabase/supabase-js"

type FileRef = {
  storage_path: string
  storage_provider: "supabase" | "r2"
}

/**
 * Resolve display URLs for a batch of files.
 * Returns a Map<storage_path, url>.
 *
 * - supabase files: batched via createSignedUrls (one API call)
 * - r2 files: parallel presigned GET URLs (or public URL if R2_PUBLIC_URL set)
 */
export async function resolveFileUrls(
  files: FileRef[],
  supabase: SupabaseClient
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>()

  const supabaseFiles = files.filter((f) => f.storage_provider === "supabase")
  const r2Files = files.filter((f) => f.storage_provider === "r2")

  // Supabase: one batch call
  if (supabaseFiles.length > 0) {
    const paths = supabaseFiles.map((f) => f.storage_path)
    const { data: signed } = await supabase.storage
      .from("files")
      .createSignedUrls(paths, 3600)
    signed?.forEach(({ path, signedUrl }) => {
      if (path && signedUrl) urlMap.set(path, signedUrl)
    })
  }

  // R2: parallel presigned GET URLs (only when R2 is configured)
  if (r2Files.length > 0 && isR2Configured()) {
    const r2PublicUrl = process.env.R2_PUBLIC_URL
    await Promise.all(
      r2Files.map(async (f) => {
        try {
          const url = r2PublicUrl
            ? getR2PublicUrl(f.storage_path)
            : await getR2SignedUrl(f.storage_path, 3600)
          urlMap.set(f.storage_path, url)
        } catch {
          // leave url missing — FileGrid handles null gracefully
        }
      })
    )
  }

  return urlMap
}

export { isR2Configured, getR2SignedUrl, getR2PublicUrl, getR2PresignedPutUrl } from "./r2"
