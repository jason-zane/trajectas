function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  );
}

export default function ClientDashboardLoading() {
  return (
    <div className="max-w-5xl space-y-16">
      {/* Hero */}
      <header className="space-y-6 pt-4">
        <Skeleton className="h-3 w-44" />
        <div className="space-y-3">
          <Skeleton className="h-14 w-4/5" />
          <Skeleton className="h-14 w-3/5" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-4 w-2/3 max-w-xl" />
        </div>
      </header>

      {/* Metric strip */}
      <section className="grid gap-8 border-t border-b border-border/70 py-8 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-16 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="grid grid-cols-2 gap-8 lg:col-span-3 lg:border-l lg:border-border/70 lg:pl-10">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      </section>

      {/* Quick actions */}
      <section className="space-y-4">
        <Skeleton className="h-3 w-28" />
        <div className="flex gap-3">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-44" />
        </div>
      </section>

      {/* Top three to watch */}
      <section className="space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-7 w-72" />
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-5 border-b border-border/70 px-6 py-5 last:border-b-0"
            >
              <Skeleton className="size-11 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
              <Skeleton className="h-8 w-20 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      </section>

      {/* Recent activity */}
      <section className="space-y-4 pb-16">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-64" />
        </div>
        <div className="space-y-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-3 py-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
              <div className="shrink-0 space-y-2 text-right">
                <Skeleton className="ml-auto h-3 w-16" />
                <Skeleton className="ml-auto h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
