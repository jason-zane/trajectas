export default function Loading() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="h-4 w-32 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
      <div className="flex items-start gap-4">
        <div className="size-14 rounded-full bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
          <div className="h-8 w-72 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
          <div className="h-4 w-96 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
        </div>
      </div>
      <div className="h-10 w-80 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent"
          />
        ))}
      </div>
    </div>
  );
}
