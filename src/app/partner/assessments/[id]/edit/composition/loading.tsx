function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  )
}

export default function CompositionLoading() {
  return (
    <div className="grid gap-6 h-[600px]">
      {/* Left panel: Factor Source */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="space-y-4 p-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          {/* Factor list shimmer */}
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>

      {/* Right panel: Assessment Canvas */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="space-y-4 p-6">
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
          {/* Canvas items */}
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
