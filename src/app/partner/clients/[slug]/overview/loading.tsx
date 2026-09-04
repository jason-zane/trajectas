function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-xl bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  )
}

export default function ClientOverviewLoading() {
  return (
    <div className="space-y-8">
      {/* Stat cards — 4 across */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-card p-5 ring-1 ring-foreground/[0.06]"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Shimmer className="h-8 w-14" />
                <Shimmer className="h-3.5 w-20" />
              </div>
              <Shimmer className="size-9 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Key context (3 cols) + Quick actions (2 cols) */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div
          className="rounded-xl bg-card p-6 ring-1 ring-foreground/[0.06] lg:col-span-3"
          style={{ animationDelay: "240ms" }}
        >
          <Shimmer className="mb-4 h-5 w-32 rounded-md" />
          <div className="space-y-3">
            <Shimmer className="h-4 w-full rounded-md" />
            <Shimmer className="h-4 w-5/6 rounded-md" />
            <Shimmer className="h-4 w-4/5 rounded-md" />
          </div>
        </div>
        <div
          className="rounded-xl bg-card p-6 ring-1 ring-foreground/[0.06] lg:col-span-2"
          style={{ animationDelay: "300ms" }}
        >
          <Shimmer className="mb-4 h-5 w-28 rounded-md" />
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Shimmer key={i} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>

      {/* Recent campaigns */}
      <div
        className="rounded-xl bg-card p-6 ring-1 ring-foreground/[0.06]"
        style={{ animationDelay: "360ms" }}
      >
        <Shimmer className="mb-4 h-5 w-36 rounded-md" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Shimmer className="size-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Shimmer className="h-4 w-1/3 rounded-md" />
                <Shimmer className="h-3 w-1/4 rounded-md" />
              </div>
              <Shimmer className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
