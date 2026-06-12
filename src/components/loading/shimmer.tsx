/**
 * Single shared shimmer block for loading skeletons.
 *
 * Every loading.tsx should compose this (directly or via the skeletons in
 * this directory) instead of redefining a local `Skeleton` — the 2026-06
 * performance audit found ~80 hand-rolled copies with three divergent
 * animation styles.
 */
export function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  );
}
