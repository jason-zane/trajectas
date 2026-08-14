function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ''}`}
      style={style}
    />
  )
}

export default function ItemReviewLoading() {
  return (
    <div className="space-y-8 max-w-6xl">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-80" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          {/* Stimulus grid + option strip */}
          <div className="space-y-6 rounded-xl bg-card p-6 ring-1 ring-foreground/[0.06]">
            <div className="grid max-w-[420px] grid-cols-3 gap-2">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="aspect-square rounded-md"
                  style={{ animationDelay: `${i * 40}ms` }}
                />
              ))}
            </div>
            <div className="grid max-w-[420px] grid-cols-3 gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="aspect-square rounded-[10px]"
                  style={{ animationDelay: `${i * 50}ms` }}
                />
              ))}
            </div>
          </div>
          <Skeleton className="h-48 rounded-xl" />
        </div>

        <div className="space-y-4">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
      <Skeleton className="h-40 rounded-xl" />
    </div>
  )
}
