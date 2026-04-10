function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  );
}

export default function ClientAssessmentDetailLoading() {
  return (
    <div className="max-w-6xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Shimmer className="h-4 w-24" />
          <Shimmer className="h-8 w-80" />
          <Shimmer className="h-4 w-96" />
        </div>
        <div className="flex gap-3">
          <Shimmer className="h-10 w-40 rounded-lg" />
          <Shimmer className="h-10 w-44 rounded-lg" />
        </div>
      </div>

      <div className="flex gap-2">
        <Shimmer className="h-5 w-28 rounded-full" />
        <Shimmer className="h-5 w-20 rounded-full" />
        <Shimmer className="h-5 w-24 rounded-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.06]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <Shimmer className="h-4 w-28" />
                <Shimmer className="h-8 w-24" />
              </div>
              <Shimmer className="size-10 rounded-xl" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <Shimmer className="h-5 w-20" />
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.06]"
            >
              <div className="space-y-3">
                <Shimmer className="h-6 w-48" />
                <Shimmer className="h-4 w-full" />
                <Shimmer className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <Shimmer className="h-5 w-20" />
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.06]"
            >
              <div className="space-y-3">
                <Shimmer className="h-6 w-40" />
                <Shimmer className="h-4 w-full" />
                <Shimmer className="h-4 w-5/6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
