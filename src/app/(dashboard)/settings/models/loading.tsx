export default function ModelsSettingsLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header shimmer */}
      <div className="flex flex-col gap-2">
        <div className="h-3 w-16 rounded animate-shimmer bg-muted" />
        <div className="h-7 w-48 rounded animate-shimmer bg-muted" />
        <div className="h-4 w-80 rounded animate-shimmer bg-muted" />
      </div>

      {/* Card shimmers */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border bg-card p-6 flex flex-col gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-lg animate-shimmer bg-muted shrink-0" />
            <div className="flex flex-col gap-2 flex-1">
              <div className="h-5 w-40 rounded animate-shimmer bg-muted" />
              <div className="h-3 w-64 rounded animate-shimmer bg-muted" />
            </div>
          </div>
          <div className="h-10 w-full rounded-lg animate-shimmer bg-muted" />
          <div className="h-3 w-48 rounded animate-shimmer bg-muted" />
        </div>
      ))}
    </div>
  )
}
