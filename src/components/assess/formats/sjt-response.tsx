"use client";

interface SJTResponseProps {
  options: { id: string; label: string; value: number }[];
  selectedValue?: number;
  onSelect: (value: number) => void;
}

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

/**
 * Situational Judgment Test response format (dark-editorial re-skin).
 *
 * Scenario block (from the item stem, rendered by parent) + lettered response options.
 * Mono letter keycaps (var(--runner-keycap); var(--runner-keycap-selected) on selected row).
 * Ghost-outline rows; selected row flips to var(--runner-selected-*) with weight 600 + shadow.
 * Single-select auto-advances.
 * Uses --runner-* custom properties exclusively.
 */
export function SJTResponse({
  options,
  selectedValue,
  onSelect,
}: SJTResponseProps) {
  return (
    <div className="space-y-2">
      {options.map((option, idx) => {
        const isSelected = selectedValue === option.value;
        const letter = LETTERS[idx] ?? String(idx + 1);

        return (
          <button
            key={option.id}
            onClick={() => onSelect(option.value)}
            className="
              flex w-full items-start gap-3 px-4 py-4 text-left text-sm
              transition-all duration-150 ease-out
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--runner-page)]
              min-h-[44px]
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
              boxShadow: isSelected ? "var(--runner-selected-shadow)" : "none",
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
            <span
              className="flex size-7 shrink-0 items-center justify-center text-xs font-semibold mt-px"
              style={{
                fontFamily: '"Geist Mono", ui-monospace, monospace',
                letterSpacing: "0.08em",
                color: isSelected
                  ? "var(--runner-keycap-selected)"
                  : "var(--runner-keycap)",
              }}
            >
              {letter}
            </span>
            <span
              className="leading-relaxed flex-1"
              style={{
                color: isSelected
                  ? "var(--runner-selected-text)"
                  : "var(--runner-text)",
                fontWeight: isSelected ? "600" : "400",
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
