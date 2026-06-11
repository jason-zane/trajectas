import { Shimmer } from "./shimmer";

interface RouteTabsSkeletonProps {
  /** Number of tab pills to render. Match the segment's real tab count. */
  tabs?: number;
  className?: string;
}

/** Tab-bar placeholder matching the RouteTabs pill row. */
export function RouteTabsSkeleton({ tabs = 4, className }: RouteTabsSkeletonProps) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      {Array.from({ length: tabs }).map((_, i) => (
        <Shimmer key={i} className="h-9 w-24 rounded-lg" />
      ))}
    </div>
  );
}
