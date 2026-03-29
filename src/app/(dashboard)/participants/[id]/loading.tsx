function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`} />
  );
}

export default function ParticipantDetailLoading() {
  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {["Overview", "Activity", "Scores", "Responses"].map((t) => (
          <Skeleton key={t} className="h-9 w-24 rounded-t-md" />
        ))}
      </div>

      {/* Content */}
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.06]"
          >
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-foreground/[0.06] space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
