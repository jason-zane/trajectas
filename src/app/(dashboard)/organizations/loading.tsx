function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`} />
  );
}

export default function OrganizationsLoading() {
  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-48 rounded-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.06]" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="size-10 rounded-xl" />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4 mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
