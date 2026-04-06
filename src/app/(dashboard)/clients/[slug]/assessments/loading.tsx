function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  )
}

export default function OrgAssessmentsLoading() {
  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-64" />
        </div>
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>

      {/* Card list */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.06] space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-7 w-20 rounded-lg" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-1.5 flex-1 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
