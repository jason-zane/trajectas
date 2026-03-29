function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`} />
  );
}

export default function ParticipantsLoading() {
  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-80" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      {/* Table rows */}
      <div className="rounded-xl bg-card shadow-sm ring-1 ring-foreground/[0.06] overflow-hidden">
        <div className="border-b px-4 py-3 flex gap-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="border-b last:border-0 px-4 py-3.5 flex items-center gap-4"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
