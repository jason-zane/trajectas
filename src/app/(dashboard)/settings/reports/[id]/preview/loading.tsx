export default function PreviewLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl p-8 space-y-8">
        {/* Cover shimmer */}
        <div className="h-48 rounded-xl bg-muted animate-shimmer" />
        {/* Bar chart shimmer */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 items-center">
              <div className="h-4 w-32 rounded bg-muted animate-shimmer" />
              <div className="h-3 flex-1 rounded bg-muted animate-shimmer" />
            </div>
          ))}
        </div>
        {/* Cards shimmer */}
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-muted animate-shimmer" />
          ))}
        </div>
      </div>
    </div>
  )
}
