"use client";

interface LikertResponseProps {
  options: { id: string; label: string; value: number }[];
  selectedValue?: number;
  onSelect: (value: number) => void;
}

/**
 * Likert scale response format.
 *
 * - Desktop (>=768px): horizontal row of rounded rectangles showing word labels
 * - Mobile (<768px): vertical stack of full-width tap targets
 * - No numbers shown — only word labels
 * - Uses brand tokens for selection state
 */
export function LikertResponse({
  options,
  selectedValue,
  onSelect,
}: LikertResponseProps) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:gap-2">
      {options.map((option) => {
        const isSelected = selectedValue === option.value;
        return (
          <button
            key={option.id}
            onClick={() => onSelect(option.value)}
            className={`
              flex-1 rounded-xl border-2 px-4 py-3 text-sm font-medium
              transition-all duration-150 ease-out
              focus-visible:outline-none focus-visible:ring-2
              min-h-[44px]
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
