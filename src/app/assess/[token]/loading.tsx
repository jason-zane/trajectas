function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  );
}

export default function AssessLoading() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header shimmer */}
      <header className="flex h-14 items-center px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Skeleton className="size-7 rounded-lg" />
          <Skeleton className="h-4 w-20" />
        </div>
      </header>

      {/* Progress bar shimmer */}
      <Skeleton className="h-0.5 w-full rounded-none" />

      {/* Card shimmer */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[540px] space-y-4">
          <Skeleton className="h-3 w-24" />
          <div className="rounded-2xl border border-border/50 p-6 sm:p-8 space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:gap-2">
              <Skeleton className="h-11 flex-1 rounded-xl" />
              <Skeleton className="h-11 flex-1 rounded-xl" />
              <Skeleton className="h-11 flex-1 rounded-xl" />
              <Skeleton className="h-11 flex-1 rounded-xl" />
              <Skeleton className="h-11 flex-1 rounded-xl" />
            </div>
          </div>
        </div>
      </main>

      {/* Footer shimmer */}
      <footer className="flex items-center justify-center px-4 py-4">
        <Skeleton className="h-3 w-48" />
      </footer>
    </div>
  );
}
