function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  );
}

interface DataTableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function DataTableSkeleton({ rows = 8, columns = 4, className }: DataTableSkeletonProps) {
  return (
    <div className={`space-y-0 rounded-lg border border-foreground/[0.06] overflow-hidden${className ? ` ${className}` : ""}`}>
      {/* Header Row */}
      <div className="flex items-center gap-4 border-b border-foreground/[0.06] bg-muted/30 px-6 py-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="flex-1" style={{ animationDelay: `${i * 40}ms` }}>
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>

      {/* Body Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex items-center gap-4 border-b border-foreground/[0.06] px-6 py-4 hover:bg-muted/20"
          style={{ animationDelay: `${(rowIdx + 1) * 80}ms` }}
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div key={colIdx} className={colIdx === 0 ? "flex-2" : "flex-1"}>
              <Skeleton className={`h-4 ${colIdx === 0 ? "w-32" : "w-24"}`} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
