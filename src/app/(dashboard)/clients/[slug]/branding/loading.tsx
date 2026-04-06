function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  )
}

export default function ClientBrandingLoading() {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="space-y-4">
        <Skeleton className="h-3.5 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>

      <div className="flex gap-8 items-start">
        {/* Controls panel skeleton */}
        <div className="w-[360px] shrink-0 space-y-6">
          <div className="rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.06] space-y-4">
            <Skeleton className="h-5 w-28" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-64" />
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1 rounded-lg" />
                <Skeleton className="size-10 rounded-lg" />
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 flex-1 rounded-md" />
                ))}
              </div>
            </div>
          </div>

          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>

        {/* Preview skeleton */}
        <div className="flex-1 min-w-0 space-y-4">
          <Skeleton className="h-9 w-48 rounded-lg" />
          <Skeleton className="h-[360px] w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
