function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  );
}

export default function ClientParticipantsLoading() {
  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-8 w-36 rounded-lg" />
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>

      {/* Table */}
      <div className="rounded-xl bg-card shadow-sm ring-1 ring-foreground/[0.06] overflow-hidden">
        {/* Table header */}
        <div className="border-b px-4 py-2.5 flex items-center gap-4">
          <div className="w-10" />
          <Skeleton className="h-3 w-24 flex-1" />
          <Skeleton className="h-3 w-40 hidden md:block" />
          <Skeleton className="h-3 w-28 hidden md:block" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16 hidden sm:block" />
        </div>

        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b last:border-0 px-4 py-3"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <Skeleton className="size-9 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
            <Skeleton className="h-3 w-28 hidden md:block" />
            <Skeleton className="h-3 w-24 hidden md:block" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-3 w-14 hidden sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
