import { Shimmer } from "./shimmer";

interface PageHeaderSkeletonProps {
  /** Render the small eyebrow line above the title. */
  eyebrow?: boolean;
  /** Render the description line under the title. */
  description?: boolean;
  /** Render an action-button placeholder on the right. */
  action?: boolean;
  className?: string;
}

/**
 * Mirrors <PageHeader> (src/components/page-header.tsx): eyebrow,
 * headline, description, right-aligned actions. Keep dimensions in sync
 * with that component so the swap from skeleton to content doesn't shift.
 */
export function PageHeaderSkeleton({
  eyebrow = false,
  description = true,
  action = false,
  className,
}: PageHeaderSkeletonProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className ?? ""}`}>
      <div>
        {eyebrow && <Shimmer className="mb-2 h-3 w-24" />}
        <Shimmer className="h-8 w-56" />
        {description && <Shimmer className="mt-2 h-4 w-80 max-w-full" />}
      </div>
      {action && <Shimmer className="h-9 w-32 shrink-0 rounded-lg" />}
    </div>
  );
}
