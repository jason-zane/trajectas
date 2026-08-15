function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ''}`}
      style={style}
    />
  )
}

export default function ItemBankLoading() {
  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>

      <Skeleton className="h-20 rounded-lg" />

      <div className="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/[0.06]">
        <div className="grid grid-cols-6 gap-3 border-b px-3 py-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-16" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-6 gap-3 border-b border-border/50 px-3 py-3"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}
