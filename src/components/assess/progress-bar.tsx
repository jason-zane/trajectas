"use client";

interface ProgressBarProps {
  /** Current item index (0-based across all sections). */
  currentIndex: number;
  /** Total number of items across all sections. */
  totalItems: number;
}

/**
 * Thin progress indicator for the participant assessment runner.
 * Proportional fill only — no percentage, no counts. By design: people
 * don't need the exact position, they need the sense of momentum.
 */
export function ProgressBar({ currentIndex, totalItems }: ProgressBarProps) {
  const pct =
    totalItems > 0 ? Math.min(100, Math.round((currentIndex / totalItems) * 100)) : 0;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label="Assessment progress"
      className="relative h-[3px] w-full overflow-hidden"
      style={{
        background:
          "var(--brand-neutral-200, color-mix(in srgb, var(--emerald) 10%, transparent))",
      }}
    >
      <div
        className="absolute inset-y-0 left-0 transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          width: `${pct}%`,
          background: "var(--brand-primary, var(--emerald))",
        }}
      />
    </div>
  );
}
