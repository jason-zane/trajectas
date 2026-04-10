export default function Loading() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div className="h-4 w-28 rounded bg-muted animate-shimmer" />
      <div className="space-y-2">
        <div className="h-4 w-24 rounded bg-muted animate-shimmer" />
        <div className="h-8 w-72 rounded bg-muted animate-shimmer" />
      </div>
      <div className="h-40 rounded-xl border border-border bg-card animate-shimmer" />
      <div className="h-80 rounded-xl border border-border bg-card animate-shimmer" />
    </div>
  );
}
