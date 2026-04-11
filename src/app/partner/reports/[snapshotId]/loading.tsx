export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16 p-6">
      <div className="flex items-center justify-between">
        <div className="h-4 w-32 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
        <div className="h-9 w-32 rounded-lg bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
      </div>
      <div className="rounded-xl border border-border bg-card shadow-sm p-8 space-y-4">
        <div className="h-8 w-3/4 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
        <div className="h-4 w-full rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
        <div className="h-4 w-5/6 rounded bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
        <div className="h-48 w-full rounded-lg bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent" />
      </div>
    </div>
  )
}
