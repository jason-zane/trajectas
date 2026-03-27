function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  )
}

export default function BrandSettingsLoading() {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="space-y-4">
        <Skeleton className="h-3.5 w-20" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-80" />
        </div>
      </div>

      <div className="flex gap-8 items-start">
        {/* Controls panel skeleton */}
        <div className="w-[360px] shrink-0 space-y-6">
          {/* Identity card */}
          <div className="rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.06] space-y-4">
            <Skeleton className="h-5 w-20" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>

          {/* Colors card */}
          <div className="rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.06] space-y-4">
            <Skeleton className="h-5 w-16" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
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
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1 rounded-lg" />
                <Skeleton className="size-10 rounded-lg" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          </div>

          {/* Typography card */}
          <div className="rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.06] space-y-4">
            <Skeleton className="h-5 w-24" />
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>

          {/* Shape card */}
          <div className="rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.06] space-y-4">
            <Skeleton className="h-5 w-16" />
            <div className="flex gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 flex-1 rounded-lg" />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Skeleton className="h-9 w-32 rounded-lg" />
            <Skeleton className="h-9 w-36 rounded-lg" />
          </div>
        </div>

        {/* Preview skeleton */}
        <div className="flex-1 min-w-0 space-y-4">
          <Skeleton className="h-9 w-48 rounded-lg" />
          <Skeleton className="h-[500px] w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
