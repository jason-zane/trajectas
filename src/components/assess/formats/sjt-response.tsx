"use client";

interface SJTResponseProps {
  options: { id: string; label: string; value: number }[];
  selectedValue?: number;
  onSelect: (value: number) => void;
}

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

/**
 * Situational Judgment Test response format.
 *
 * Scenario block (from the item stem, rendered by parent) + lettered response options.
 * Single-select auto-advances. (Rank mode would need Continue, but current
 * implementation is single-select.)
 * Uses brand tokens for styling.
 */
export function SJTResponse({
  options,
  selectedValue,
  onSelect,
}: SJTResponseProps) {
  return (
    <div className="space-y-2.5">
      {options.map((option, idx) => {
        const isSelected = selectedValue === option.value;
        const letter = LETTERS[idx] ?? String(idx + 1);

        return (
          <button
            key={option.id}
            onClick={() => onSelect(option.value)}
            className={`
              flex w-full items-start gap-3 rounded-xl border-2 px-4 py-4 text-left text-sm
              transition-all duration-150 ease-out
              focus-visible:outline-none focus-visible:ring-2
              min-h-[44px]
              ${isSelected ? "scale-[1.005]" : "hover:scale-[1.003]"}
            `}
            style={{
              borderColor: isSelected
                ? "var(--brand-primary, hsl(var(--primary)))"
                : "var(--brand-neutral-200, hsl(var(--border)))",
              background: isSelected
                ? "var(--brand-surface, hsl(var(--primary) / 0.08))"
                : "transparent",
            }}
            aria-pressed={isSelected}
          >
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold mt-px"
              style={{
                background: isSelected
                  ? "var(--brand-primary, hsl(var(--primary)))"
                  : "var(--brand-neutral-200, hsl(var(--muted)))",
                color: isSelected
                  ? "var(--brand-primary-foreground, hsl(var(--primary-foreground)))"
                  : "var(--brand-neutral-600, hsl(var(--muted-foreground)))",
              }}
            >
              {letter}
            </span>
            <span
              className="leading-relaxed"
              style={{
                color: isSelected
                  ? "var(--brand-primary, hsl(var(--primary)))"
                  : "var(--brand-text, hsl(var(--foreground)))",
              }}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
