import { FileGridClient, type FileItem } from "./FileGridClient"

interface Props {
  files: FileItem[]
}

export function FileGrid({ files }: Props) {
  if (files.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Brak plików w tej lokalizacji.
      </p>
    )
  }

  return <FileGridClient files={files} />
}
