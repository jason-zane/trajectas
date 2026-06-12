function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  )
}

export default function CreateAssessmentLoading() {
  return (
    <div className="space-y-8 max-w-3xl">
      {/* Page header skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Basics card */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="space-y-4 px-6 py-5">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="space-y-4">
            {/* Title input */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            {/* Description textarea */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
            {/* Source picker */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Submit button */}
      <Skeleton className="h-10 w-32 rounded-lg" />
    </div>
  )
}
