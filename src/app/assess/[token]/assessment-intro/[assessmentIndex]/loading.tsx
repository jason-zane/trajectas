function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  );
}

export default function AssessmentIntroLoading() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-14 items-center px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Skeleton className="size-7 rounded-lg" />
          <Skeleton className="h-4 w-24" />
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[540px] space-y-6 rounded-[28px] border border-border/60 bg-card/90 p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-primary/20 bg-primary/5">
            <div className="size-6 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-primary/80">
              Next assessment
            </p>
            <Skeleton className="mx-auto h-8 w-3/4" />
            <Skeleton className="mx-auto h-4 w-full" />
            <Skeleton className="mx-auto h-4 w-5/6" />
          </div>

          <div className="flex justify-center pt-2">
            <Skeleton className="h-11 w-[220px] rounded-xl" />
          </div>
        </div>
      </main>
    </div>
  );
}
