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
 * Likert scale response format (dark-editorial re-skin).
 *
 * - Desktop (>=768px): CSS Grid with equal-width columns, all same height (min-h 62px)
 * - Mobile (<768px): vertical stack of full-width tap targets (min-h 46–54px)
 * - Word labels only, 13–14px/500
 * - Ghost outline buttons (1px border, var(--runner-ghost-*) fill/border)
 * - Selected state flips to var(--runner-selected-*) with weight 600 + shadow
 * - Uses --runner-* custom properties exclusively
 */
export function LikertResponse({
  options,
  selectedValue,
  onSelect,
}: LikertResponseProps) {
  const gridCols = GRID_COLS[options.length] ?? "md:grid-cols-5";

  return (
    <div className={`grid grid-cols-1 gap-2 md:gap-3 ${gridCols}`}>
      {options.map((option) => {
        const isSelected = selectedValue === option.value;
        return (
          <button
            key={option.id}
            onClick={() => onSelect(option.value)}
            className="
              flex items-center justify-center text-center text-balance
              leading-[1.15] transition-all duration-150 ease-out
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--runner-page)]
              px-3 py-3 md:px-3 md:py-3
              min-h-[46px] md:min-h-[68px] text-sm font-medium
              active:scale-95
            "
            style={{
              borderRadius: "10px",
              border: "1px solid",
              borderColor: isSelected
                ? "var(--runner-selected-fill)"
                : "var(--runner-ghost-border)",
              backgroundColor: isSelected
                ? "var(--runner-selected-fill)"
                : "var(--runner-ghost-fill)",
              color: isSelected
                ? "var(--runner-selected-text)"
                : "var(--runner-text)",
              boxShadow: isSelected ? "var(--runner-selected-shadow)" : "none",
              fontWeight: isSelected ? "600" : "500",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "var(--runner-ghost-border-hover)";
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "var(--runner-ghost-fill-hover)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "var(--runner-ghost-border)";
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "var(--runner-ghost-fill)";
              }
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
