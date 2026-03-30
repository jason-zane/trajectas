function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  )
}

export default function GenerationRunLoading() {
  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-64" />
        </div>
      </div>
      <div className="flex gap-6">
        <Skeleton className="h-96 w-48 shrink-0" />
        <Skeleton className="h-96 flex-1" />
      </div>
    </div>
  )
}
