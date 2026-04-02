export default function AiPurposeDetailLoading() {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      {/* Back link */}
      <div>
        <div className="h-4 w-32 rounded animate-shimmer bg-muted mb-2" />
        <div className="flex flex-col gap-2">
          <div className="h-3 w-24 rounded animate-shimmer bg-muted" />
          <div className="h-7 w-56 rounded animate-shimmer bg-muted" />
          <div className="h-4 w-96 rounded animate-shimmer bg-muted" />
        </div>
      </div>

      {/* Model card */}
      <div className="rounded-xl border bg-card p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-4 rounded animate-shimmer bg-muted" />
            <div className="h-4 w-16 rounded animate-shimmer bg-muted" />
          </div>
          <div className="h-8 w-20 rounded-lg animate-shimmer bg-muted" />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="h-4 w-64 rounded animate-shimmer bg-muted" />
          <div className="h-3 w-32 rounded animate-shimmer bg-muted" />
        </div>
      </div>

      {/* Prompt textarea */}
      <div className="rounded-xl border bg-card p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="h-4 w-28 rounded animate-shimmer bg-muted" />
            <div className="h-3 w-36 rounded animate-shimmer bg-muted" />
          </div>
          <div className="h-8 w-36 rounded-lg animate-shimmer bg-muted" />
        </div>
        <div className="h-64 w-full rounded-lg animate-shimmer bg-muted" />
      </div>

      {/* Version history */}
      <div className="flex flex-col gap-3">
        <div className="h-4 w-36 rounded animate-shimmer bg-muted" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card p-4 flex flex-col gap-3"
          >
            <div className="flex items-center gap-2">
              <div className="h-5 w-10 rounded animate-shimmer bg-muted" />
              <div className="h-3 w-32 rounded animate-shimmer bg-muted" />
            </div>
            <div className="h-16 w-full rounded animate-shimmer bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
