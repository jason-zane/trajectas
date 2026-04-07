export default function EmailTemplatesLoading() {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="space-y-2">
        <div className="h-3.5 w-16 rounded animate-shimmer bg-muted" />
        <div className="h-7 w-48 rounded animate-shimmer bg-muted" />
        <div className="h-4 w-80 rounded animate-shimmer bg-muted" />
      </div>

      {/* Scope selector */}
      <div className="h-10 w-64 rounded-lg animate-shimmer bg-muted" />

      {/* Category groups */}
      {Array.from({ length: 3 }).map((_, g) => (
        <div key={g} className="space-y-3">
          <div className="h-5 w-32 rounded animate-shimmer bg-muted" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: g === 1 ? 3 : 2 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.06] space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-lg animate-shimmer bg-muted" />
                  <div className="space-y-1 flex-1">
                    <div className="h-4 w-32 rounded animate-shimmer bg-muted" />
                    <div className="h-3 w-20 rounded animate-shimmer bg-muted" />
                  </div>
                </div>
                <div className="h-3.5 w-48 rounded animate-shimmer bg-muted" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
