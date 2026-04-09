function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  );
}

export default function PartnerParticipantDetailLoading() {
  return (
    <div className="max-w-6xl space-y-8">
      {/* Back button */}
      <Skeleton className="h-9 w-40 rounded-full" />

      {/* PageHeader */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.06]"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-9 w-12" />
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-36" />
              </div>
              <Skeleton className="size-10 shrink-0 rounded-xl" />
            </div>
          </div>
        ))}
      </div>

      {/* Participant overview + Assessment sessions */}
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        {/* Overview */}
        <div className="rounded-xl bg-card shadow-sm ring-1 ring-foreground/[0.06]">
          <div className="space-y-2 border-b border-border/70 px-6 py-4">
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="space-y-4 p-6">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/70 p-3 space-y-2">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="rounded-lg border border-border/70 p-3 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </div>
        </div>

        {/* Assessment sessions */}
        <div className="rounded-xl bg-card shadow-sm ring-1 ring-foreground/[0.06]">
          <div className="space-y-2 border-b border-border/70 px-6 py-4">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3.5 w-52" />
          </div>
          <div className="space-y-3 p-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-border/70 px-4 py-3"
                style={{ animationDelay: `${(i + 4) * 60}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity timeline */}
      <div className="rounded-xl bg-card shadow-sm ring-1 ring-foreground/[0.06]">
        <div className="space-y-2 border-b border-border/70 px-6 py-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3.5 w-44" />
        </div>
        <div className="space-y-3 p-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border border-border/70 px-4 py-3"
              style={{ animationDelay: `${(i + 7) * 60}ms` }}
            >
              <Skeleton className="mt-0.5 size-8 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
