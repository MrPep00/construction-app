export default function Loading() {
  return (
    <main className="container mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 h-4 w-48 animate-pulse rounded bg-muted" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 w-28 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </main>
  )
}
