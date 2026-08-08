import Link from "next/link"

export type Metric = {
  label: string
  value: number
  /** Optional target view; card renders as a plain tile when absent */
  href?: string
}

const cardClass = "rounded-xl border border-border bg-card p-4"

function MetricContent({ metric }: { metric: Metric }) {
  return (
    <>
      <p className="text-3xl font-semibold tabular-nums">{metric.value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{metric.label}</p>
    </>
  )
}

export function MetricCards({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((m) =>
        m.href ? (
          <Link
            key={m.label}
            href={m.href}
            className={`${cardClass} transition-colors hover:border-brand hover:bg-muted`}
          >
            <MetricContent metric={m} />
          </Link>
        ) : (
          <div key={m.label} className={cardClass}>
            <MetricContent metric={m} />
          </div>
        )
      )}
    </div>
  )
}
