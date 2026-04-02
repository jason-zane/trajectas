export default function AiConfigurationLoading() {
  return (
    <div className="flex flex-col gap-8 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-24 rounded animate-shimmer bg-muted" />
          <div className="h-7 w-52 rounded animate-shimmer bg-muted" />
          <div className="h-4 w-96 rounded animate-shimmer bg-muted" />
        </div>
        <div className="h-16 w-56 rounded-lg animate-shimmer bg-muted shrink-0" />
      </div>

      {/* Apply to all bar */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg animate-shimmer bg-muted shrink-0" />
          <div className="flex flex-col gap-1.5 flex-1">
            <div className="h-4 w-24 rounded animate-shimmer bg-muted" />
            <div className="h-3 w-64 rounded animate-shimmer bg-muted" />
          </div>
          <div className="h-10 w-72 rounded-lg animate-shimmer bg-muted" />
          <div className="h-8 w-24 rounded-lg animate-shimmer bg-muted" />
        </div>
      </div>

      {/* Card grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card p-5 flex flex-col gap-4"
          >
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-lg animate-shimmer bg-muted shrink-0" />
              <div className="flex flex-col gap-1.5 flex-1">
                <div className="h-4 w-32 rounded animate-shimmer bg-muted" />
                <div className="h-3 w-full rounded animate-shimmer bg-muted" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="h-3 w-40 rounded animate-shimmer bg-muted" />
                <div className="h-5 w-10 rounded animate-shimmer bg-muted" />
              </div>
              <div className="size-4 rounded animate-shimmer bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
