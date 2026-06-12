function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  )
}

export default function PresentationLoading() {
  return (
    <div className="space-y-6 max-w-3xl">
      {/* Format mode section */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Block size options (if forced choice) */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Sections configurator */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="space-y-4 p-6">
          <Skeleton className="h-4 w-28" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
