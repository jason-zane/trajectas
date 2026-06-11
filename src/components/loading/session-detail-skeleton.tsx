import { Shimmer } from "./shimmer";

/**
 * Shared skeleton for session detail pages.
 * Used by 3 pages: dashboard, client, and partner session detail views.
 */
export function SessionDetailSkeleton() {
  return (
    <div className="space-y-6 max-w-6xl">
      <Shimmer className="h-4 w-32" />
      <div className="space-y-2">
        <Shimmer className="h-4 w-40" />
        <Shimmer className="h-8 w-72" />
        <Shimmer className="h-4 w-96" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl bg-muted animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-transparent via-foreground/[0.03] to-transparent"
          />
        ))}
      </div>
      <Shimmer className="h-10 w-64" />
      <Shimmer className="h-64 rounded-xl" />
    </div>
  );
}
