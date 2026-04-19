import { cn } from "@/lib/utils";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%]",
        className
      )}
    />
  );
}

interface DataTableLoadingProps {
  columnCount: number;
  rowCount?: number;
  filterCount?: number;
  className?: string;
}

export function DataTableLoading({
  columnCount,
  rowCount = 6,
  filterCount = 2,
  className,
}: DataTableLoadingProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-sm ring-1 ring-foreground/[0.06]",
        className
      )}
    >
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <Shimmer className="h-10 w-full sm:max-w-sm" />
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: filterCount }).map((_, index) => (
            <Shimmer key={index} className="h-9 w-28 rounded-lg" />
          ))}
        </div>
      </div>

      <div className="px-4 py-3">
        <div
          className="grid gap-3 border-b border-border pb-3"
          style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columnCount }).map((_, index) => (
            <Shimmer key={index} className="h-3 w-16" />
          ))}
        </div>

        <div className="divide-y divide-border">
          {Array.from({ length: rowCount }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="grid gap-3 py-4"
              style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: columnCount }).map((__, columnIndex) => (
                <Shimmer
                  key={columnIndex}
                  className={cn(
                    "h-4",
                    columnIndex === 0 ? "w-32" : columnIndex === columnCount - 1 ? "w-20" : "w-24"
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Shimmer className="h-4 w-40" />
        <div className="flex items-center gap-2">
          <Shimmer className="h-8 w-28 rounded-lg" />
          <Shimmer className="h-8 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
