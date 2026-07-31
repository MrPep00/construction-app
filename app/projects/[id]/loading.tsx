export default function Loading() {
  return (
    <main className="px-4 py-6 md:px-6 lg:px-10">
      <div className="mb-4 h-4 w-48 animate-pulse rounded bg-muted" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-8 w-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div>
          {/* Metric cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[92px] animate-pulse rounded-xl border border-border-soft bg-muted"
              />
            ))}
          </div>

          {/* Building matrix */}
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="h-11 w-20 shrink-0 animate-pulse rounded-lg bg-muted" />
                <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1.5">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div
                      key={j}
                      className="h-11 animate-pulse rounded-lg border border-border-soft bg-muted"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="mt-6 lg:mt-0">
          <div className="h-64 animate-pulse rounded-xl border border-border-soft bg-muted" />
        </aside>
      </div>
    </main>
  )
}
