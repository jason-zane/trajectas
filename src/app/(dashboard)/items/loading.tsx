function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`} style={style} />
  );
}

export default function ItemsLoading() {
  return (
    <div className="space-y-8 max-w-6xl">
      {/* PageHeader */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 w-56 rounded-lg" />
      </div>

      {/* Format pills */}
      <div className="flex gap-2 flex-wrap -mt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-16 rounded-full" style={{ animationDelay: `${i * 50}ms` }} />
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl bg-card shadow-sm ring-1 ring-foreground/[0.06] overflow-hidden">
        <div className="grid grid-cols-5 gap-3 px-3 py-2.5 border-b">
          <Skeleton className="h-3 w-12 col-span-2" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="grid grid-cols-5 gap-3 px-3 py-3 border-b border-border/50" style={{ animationDelay: `${i * 60}ms` }}>
            <Skeleton className="h-4 w-full col-span-2" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
