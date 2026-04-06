function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  )
}

export default function PartnerOverviewLoading() {
  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-foreground/[0.06]"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-12" />
              </div>
              <Skeleton className="h-5 w-5 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Portal button placeholder */}
      <Skeleton className="h-10 w-48 rounded-lg" />

      {/* Edit form skeleton */}
      <div className="max-w-2xl space-y-6">
        <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-foreground/[0.06] space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3.5 w-56" />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-12" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-12" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <Skeleton className="h-px w-full" />
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
