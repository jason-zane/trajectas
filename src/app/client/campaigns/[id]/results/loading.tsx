export default function Loading() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="space-y-2">
        <div className="h-4 w-24 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
        <div className="h-8 w-80 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-xl bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent"
          />
        ))}
      </div>
      <div className="h-10 w-60 rounded-lg bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
      <div className="h-96 rounded-xl bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
    </div>
  );
}
