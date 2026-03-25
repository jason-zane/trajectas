function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`} />
  );
}

export default function ConstructsLoading() {
  return (
    <div className="space-y-8 max-w-5xl">
      {/* PageHeader */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>

      {/* Row cards */}
      <div className="grid gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-card px-5 py-4 shadow-sm ring-1 ring-foreground/[0.06] flex items-center gap-4"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <Skeleton className="size-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-3 w-20 hidden sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
