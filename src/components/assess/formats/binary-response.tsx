"use client";

interface BinaryResponseProps {
  options: { id: string; label: string; value: number }[];
  selectedValue?: number;
  onSelect: (value: number) => void;
}

/**
 * Binary (Yes/No) response format.
 *
 * Two large side-by-side tap targets.
 * Auto-advances on selection.
 * Touch targets >= 44px.
 * Uses brand tokens for selection state.
 */
export function BinaryResponse({
  options,
  selectedValue,
  onSelect,
}: BinaryResponseProps) {
  // Use first two options, or fallback to Yes/No
  const choices =
    options.length >= 2
      ? options.slice(0, 2)
      : [
          { id: "yes", label: "Yes", value: 1 },
          { id: "no", label: "No", value: 0 },
        ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {choices.map((option) => {
        const isSelected = selectedValue === option.value;
        return (
          <button
            key={option.id}
            onClick={() => onSelect(option.value)}
            className={`
              rounded-xl border-2 px-4 py-8 text-center text-lg font-semibold
              transition-all duration-150 ease-out
              focus-visible:outline-none focus-visible:ring-2
              min-h-[72px]
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
