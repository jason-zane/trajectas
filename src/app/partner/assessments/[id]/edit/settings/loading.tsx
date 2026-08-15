function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  )
}

export default function SettingsLoading() {
  return (
    <div className="space-y-6 max-w-3xl">
      {/* Custom factors card */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full max-w-xs" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-24 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Scoring card */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full max-w-md rounded-lg" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        </div>
      </div>

      {/* Danger zone card */}
      <div className="rounded-2xl border border-red-200 bg-red-50/50 shadow-sm">
        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </div>
          <Skeleton className="h-10 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
