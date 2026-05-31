export function isPdf(file: { mime_type: string; name: string }): boolean {
  return (
    file.mime_type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  )
}
