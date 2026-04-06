function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  );
}

export default function UserDetailLoading() {
  return (
    <div className="space-y-8">
      <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Skeleton className="size-3.5 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>

      <div className="flex items-start gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.2fr]">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-40" />
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-72" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-80" />
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>
    </div>
  );
}
