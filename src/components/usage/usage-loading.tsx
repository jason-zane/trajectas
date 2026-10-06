export function UsageLoading() {
  return (
    <div className="space-y-6" aria-label="Loading usage">
      <div className="h-16 animate-shimmer rounded-xl bg-muted" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-28 animate-shimmer rounded-xl bg-muted"
          />
        ))}
      </div>
      <div className="h-44 animate-shimmer rounded-xl bg-muted" />
      <div className="h-64 animate-shimmer rounded-xl bg-muted" />
    </div>
  );
}
