"use client";

interface ProgressBarProps {
  /** Current item index (0-based across all sections). */
  currentIndex: number;
  /** Total number of items across all sections. */
  totalItems: number;
}

/**
 * Thin 2px progress bar for the assessment runner.
 * Shows proportional progress only — no text, no counts, no percentage.
 * Uses --brand-primary for the fill color.
 */
export function ProgressBar({ currentIndex, totalItems }: ProgressBarProps) {
  const pct = totalItems > 0 ? Math.round((currentIndex / totalItems) * 100) : 0;

  return (
    <div className="h-0.5 w-full" style={{ background: "var(--brand-neutral-200, hsl(var(--border)))" }}>
      <div
        className="h-full transition-all duration-500 ease-out"
        style={{
          width: `${pct}%`,
          background: "var(--brand-primary, hsl(var(--primary)))",
        }}
      />
    </div>
  );
}
