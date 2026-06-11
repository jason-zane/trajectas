import { Shimmer } from "./shimmer";

/**
 * Shared skeleton for taxonomy edit/create pages (constructs, dimensions, factors, items).
 * Used by 8 pages across the dashboard.
 */
export function TaxonomyFormEditSkeleton() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div className="space-y-4">
        <Shimmer className="h-3.5 w-48" />
        <div className="space-y-2">
          <Shimmer className="h-7 w-48" />
          <Shimmer className="h-4 w-72" />
        </div>
      </div>

      <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-foreground/[0.06] space-y-6">
        <div className="space-y-2">
          <Shimmer className="h-5 w-28" />
          <Shimmer className="h-3 w-56" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2" style={{ animationDelay: `${i * 80}ms` }}>
            <Shimmer className="h-4 w-20" />
            <Shimmer className="h-9 w-full rounded-lg" />
            <Shimmer className="h-3 w-48" />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3 py-4 border-t border-border/50">
        <Shimmer className="h-9 w-20 rounded-lg" />
        <Shimmer className="h-9 w-36 rounded-lg" />
      </div>
    </div>
  );
}
