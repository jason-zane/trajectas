function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  )
}

export default function OrgReportsLoading() {
  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="space-y-1">
        <Skeleton className="h-5 w-52" />
        <Skeleton className="h-3.5 w-72" />
      </div>

      {/* Self-Report section */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={`self-${i}`}
            className="flex items-start gap-3 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/[0.06]"
          >
            <Skeleton className="mt-0.5 size-4 shrink-0 rounded-[4px]" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3.5 w-64" />
            </div>
          </div>
        ))}
      </div>

      {/* 360 section */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={`360-${i}`}
            className="flex items-start gap-3 rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/[0.06]"
          >
            <Skeleton className="mt-0.5 size-4 shrink-0 rounded-[4px]" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3.5 w-64" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
