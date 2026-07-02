"use client";

interface BinaryResponseProps {
  options: { id: string; label: string; value: number }[];
  selectedValue?: number;
  onSelect: (value: number) => void;
}

/**
 * Binary (Yes/No) response format (dark-editorial re-skin).
 *
 * Two large side-by-side ghost-outline buttons.
 * Auto-advances on selection.
 * Touch targets >= 44px.
 * Selected state flips to var(--runner-selected-*) with weight 600 + shadow.
 * Uses --runner-* custom properties exclusively.
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
            className="
              px-4 py-6 sm:py-8 text-center text-base sm:text-lg font-semibold
              transition-all duration-150 ease-out
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--runner-page)]
              min-h-[56px] sm:min-h-[72px]
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
              fontWeight: isSelected ? "600" : "600",
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
