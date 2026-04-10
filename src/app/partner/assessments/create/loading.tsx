function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  );
}

export default function Loading() {
  return (
    <div className="space-y-8 max-w-6xl">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96" />
      </div>

      <Skeleton className="h-64 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Skeleton className="h-[520px] rounded-xl" />
        <Skeleton className="h-[520px] rounded-xl" />
      </div>
    </div>
  );
}
