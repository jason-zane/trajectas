import { Shimmer } from "./shimmer";

/**
 * Shared skeleton for participant detail pages.
 * Used by 3 pages: dashboard and client/partner participant detail views.
 */
export function ParticipantDetailSkeleton() {
  return (
    <div className="space-y-6 max-w-6xl">
      <Shimmer className="h-4 w-32" />
      <div className="flex items-start gap-4">
        <Shimmer className="size-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-4 w-24" />
          <Shimmer className="h-8 w-72" />
          <Shimmer className="h-4 w-96" />
        </div>
      </div>
      <Shimmer className="h-10 w-80" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Shimmer key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
