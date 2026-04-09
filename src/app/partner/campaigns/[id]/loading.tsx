function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  );
}

export default function PartnerCampaignDetailLoading() {
  return (
    <div className="space-y-8 max-w-6xl">
      {/* Back button */}
      <Skeleton className="h-9 w-40 rounded-full" />

      {/* PageHeader */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-4 w-56" />
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
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="size-10 rounded-xl shrink-0" />
            </div>
          </div>
        ))}
      </div>

      {/* Assessment lineup + Participants table */}
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        {/* Assessment lineup */}
        <div className="rounded-xl bg-card shadow-sm ring-1 ring-foreground/[0.06]">
          <div className="px-6 py-4 border-b border-border/70 space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3.5 w-48" />
          </div>
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-border/70 px-4 py-3"
                style={{ animationDelay: `${(i + 4) * 60}ms` }}
              >
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Participants table */}
        <div className="rounded-xl bg-card shadow-sm ring-1 ring-foreground/[0.06]">
          <div className="px-6 py-4 border-b border-border/70 space-y-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3.5 w-52" />
          </div>
          <div className="p-6 space-y-3">
            {/* Table header row */}
            <div className="grid grid-cols-4 gap-4 pb-2 border-b border-border/50">
              {["Participant", "Status", "Invited", "Completed"].map((col) => (
                <Skeleton key={col} className="h-3 w-16" />
              ))}
            </div>
            {/* Table body rows */}
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-4 gap-4 py-2"
                style={{ animationDelay: `${(i + 7) * 60}ms` }}
              >
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
