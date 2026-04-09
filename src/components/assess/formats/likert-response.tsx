"use client";

interface LikertResponseProps {
  options: { id: string; label: string; value: number }[];
  selectedValue?: number;
  onSelect: (value: number) => void;
}

/** Static lookup to avoid Tailwind purge issues with dynamic class names. */
const GRID_COLS: Record<number, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
  6: "md:grid-cols-6",
  7: "md:grid-cols-7",
};

/**
 * Likert scale response format.
 *
 * - Desktop (>=768px): CSS Grid with equal-width columns, all same height
 * - Mobile (<768px): vertical stack of full-width tap targets
 * - No numbers shown — only word labels
 * - Uses brand tokens for selection state
 */
export function LikertResponse({
  options,
  selectedValue,
  onSelect,
}: LikertResponseProps) {
  const gridCols = GRID_COLS[options.length] ?? "md:grid-cols-5";

  return (
    <div className={`grid grid-cols-1 gap-2 ${gridCols}`}>
      {options.map((option) => {
        const isSelected = selectedValue === option.value;
        return (
          <button
            key={option.id}
            onClick={() => onSelect(option.value)}
            className={`
              grid place-items-center rounded-xl border-2 px-3 py-3
              text-sm font-medium transition-all duration-150 ease-out
              focus-visible:outline-none focus-visible:ring-2
              min-h-[56px]
              ${isSelected ? "scale-[1.02]" : "hover:scale-[1.01]"}
            `}
            style={{
              borderColor: isSelected
                ? "var(--brand-primary, hsl(var(--primary)))"
                : "var(--brand-neutral-200, hsl(var(--border)))",
              background: isSelected
                ? "var(--brand-surface, hsl(var(--primary) / 0.08))"
                : "transparent",
              color: isSelected
                ? "var(--brand-primary, hsl(var(--primary)))"
                : "var(--brand-text, hsl(var(--foreground)))",
            }}
            aria-pressed={isSelected}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
