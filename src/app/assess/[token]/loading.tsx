function PulseDot({ delayClass }: { delayClass?: string }) {
  return (
    <span
      className={`inline-block size-2 rounded-full bg-primary/70 animate-bounce ${delayClass ?? ""}`}
    />
  );
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  );
}

export default function AssessLoading() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-14 items-center px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Skeleton className="size-7 rounded-lg" />
          <Skeleton className="h-4 w-24" />
        </div>
      </header>

      <Skeleton className="h-0.5 w-full rounded-none" />

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[620px] rounded-[28px] border border-border/60 bg-card/90 p-6 shadow-sm sm:p-8">
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="relative flex size-20 items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-primary/15 bg-primary/5" />
              <div className="absolute inset-[10px] rounded-full border border-primary/20" />
              <div className="flex items-center gap-1.5">
                <PulseDot />
                <PulseDot delayClass="[animation-delay:120ms]" />
                <PulseDot delayClass="[animation-delay:240ms]" />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-primary/80">
                Preparing
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Loading your assessment
              </h1>
              <p className="max-w-md text-sm text-muted-foreground sm:text-base">
                Pulling in your next step and restoring your progress.
              </p>
            </div>

            <div className="w-full max-w-[420px] space-y-3 pt-2">
              <Skeleton className="h-4 w-24" />
              <div className="rounded-2xl border border-border/50 p-5">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-4/5" />
                  <Skeleton className="h-11 w-full rounded-xl" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
