import { createClient } from "@/lib/supabase/server"
import { FileGridClient, type FileItem } from "./FileGridClient"

interface Props {
  locationId: string
}

export async function FileGrid({ locationId }: Props) {
  const supabase = await createClient()

  const { data: files } = await supabase
    .from("files")
    .select("id, name, mime_type, size_bytes, created_at, storage_path")
    .eq("location_id", locationId)
    .order("created_at", { ascending: false })

  if (!files || files.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Brak plików w tej lokalizacji.
      </p>
    )
  }

  // Batch-generate signed URLs (1-hour TTL) in a single API call
  const paths = files.map((f) => f.storage_path)
  const { data: signedUrls } = await supabase.storage
    .from("files")
    .createSignedUrls(paths, 3600)

  const urlMap = new Map<string, string>()
  signedUrls?.forEach(({ path, signedUrl }) => {
    if (path && signedUrl) urlMap.set(path, signedUrl)
  })

  const items: FileItem[] = files.map((f) => ({
    ...f,
    signedUrl: urlMap.get(f.storage_path) ?? null,
  }))

  return <FileGridClient files={items} />
}
