/**
 * Shared loading shapes for the item bank routes. Not a route file — only
 * `page.tsx`, `layout.tsx`, `loading.tsx` and friends are special in this
 * directory, so this sits alongside them safely.
 *
 * Shimmer, not pulse, per docs/ui-standards.md.
 */

export function Shimmer({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ''}`}
      style={style}
    />
  )
}

export function TableSkeleton({ columns = 6, rows = 6 }: { columns?: number; rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/[0.06]">
      <div
        className="grid gap-3 border-b px-3 py-2.5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }).map((_, i) => (
          <Shimmer key={i} className="h-3 w-16" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-3 border-b border-border/50 px-3 py-3"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            animationDelay: `${rowIndex * 60}ms`,
          }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Shimmer key={colIndex} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Header + stat row + table, the shape most item bank list routes take. */
export function ListPageSkeleton({
  stats = 4,
  columns = 6,
}: {
  stats?: number
  columns?: number
}) {
  return (
    <div className="space-y-8 max-w-6xl">
      <div className="space-y-2">
        <Shimmer className="h-8 w-32" />
        <Shimmer className="h-3 w-20" />
        <Shimmer className="h-7 w-64" />
        <Shimmer className="h-4 w-96" />
      </div>
      {stats > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: stats }).map((_, i) => (
            <Shimmer key={i} className="h-24 rounded-xl" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      ) : null}
      <Shimmer className="h-20 rounded-lg" />
      <TableSkeleton columns={columns} />
    </div>
  )
}
