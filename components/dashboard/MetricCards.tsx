export type Metric = {
  label: string
  value: number
}

export function MetricCards({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((m) => (
        <div key={m.label} className="rounded-xl border border-border bg-card p-4">
          <p className="text-3xl font-semibold tabular-nums">{m.value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{m.label}</p>
        </div>
      ))}
    </div>
  )
}
