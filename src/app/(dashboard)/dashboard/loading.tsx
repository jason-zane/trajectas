function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  );
}

export default function DashboardLoading() {
  return (
    <div className="space-y-12 max-w-6xl">
      {/* Hero */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.06]"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3.5 w-20" />
              </div>
              <Skeleton className="size-10 rounded-xl" />
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="space-y-5">
        <Skeleton className="h-6 w-32" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/[0.06]"
              style={{ animationDelay: `${(i + 6) * 60}ms` }}
            >
              <div className="flex items-center gap-4">
                <Skeleton className="size-11 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
