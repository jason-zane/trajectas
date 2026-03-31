export default function ItemSelectionSettingsLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header shimmer */}
      <div className="flex flex-col gap-2">
        <div className="h-3 w-16 rounded animate-shimmer bg-muted" />
        <div className="h-7 w-56 rounded animate-shimmer bg-muted" />
        <div className="h-4 w-96 rounded animate-shimmer bg-muted" />
      </div>

      {/* Rules card shimmer */}
      <div className="rounded-xl border bg-card p-6 flex flex-col gap-4 max-w-3xl">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-lg animate-shimmer bg-muted shrink-0" />
          <div className="flex flex-col gap-2 flex-1">
            <div className="h-5 w-48 rounded animate-shimmer bg-muted" />
            <div className="h-3 w-80 rounded animate-shimmer bg-muted" />
          </div>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border p-4 flex items-end gap-3"
          >
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-20 rounded animate-shimmer bg-muted" />
              <div className="h-9 w-full rounded-lg animate-shimmer bg-muted" />
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 rounded animate-shimmer bg-muted" />
              <div className="h-9 w-full rounded-lg animate-shimmer bg-muted" />
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-28 rounded animate-shimmer bg-muted" />
              <div className="h-9 w-full rounded-lg animate-shimmer bg-muted" />
            </div>
            <div className="size-9 rounded animate-shimmer bg-muted shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
