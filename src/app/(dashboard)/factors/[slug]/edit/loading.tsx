function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`} />
  );
}

export default function FormLoading() {
  return (
    <div className="space-y-8 max-w-2xl">
      {/* Breadcrumb + PageHeader */}
      <div className="space-y-4">
        <Skeleton className="h-3.5 w-48" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>

      {/* Form card */}
      <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-foreground/[0.06] space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-56" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2" style={{ animationDelay: `${i * 80}ms` }}>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-3 w-48" />
          </div>
        ))}
      </div>

      {/* Sticky footer */}
      <div className="flex items-center justify-end gap-3 py-4 border-t border-border/50">
        <Skeleton className="h-9 w-20 rounded-lg" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
    </div>
  );
}
