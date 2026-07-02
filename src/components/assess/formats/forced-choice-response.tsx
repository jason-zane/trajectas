"use client";

import { useState } from "react";

interface ForcedChoiceResponseProps {
  options: { id: string; label: string; value: number }[];
  selectedValue?: number;
  onSelect: (value: number, data: Record<string, unknown>) => void;
  responseData?: Record<string, unknown>;
}

/**
 * Forced choice response format (dark-editorial re-skin).
 *
 * Two ghost-outline statement buttons with hairline "or" divider.
 * Participant selects one statement as "most like me" — single tap auto-advances.
 * Selected state flips to var(--runner-selected-*) with weight 600 + shadow.
 * Uses --runner-* custom properties exclusively.
 */
export function ForcedChoiceResponse({
  options,
  selectedValue,
  onSelect,
  responseData,
}: ForcedChoiceResponseProps) {
  const [selected, setSelected] = useState<number | undefined>(
    (responseData?.mostLike as number | undefined) ?? selectedValue
  );

  // Only show first two options for forced choice
  const choices = options.slice(0, 2);

  function handleSelect(value: number) {
    setSelected(value);
    const other = choices.find((c) => c.value !== value);
    onSelect(value, {
      mostLike: value,
      leastLike: other?.value ?? 0,
    });
  }

  return (
    <div className="space-y-3">
      {choices.map((option, idx) => {
        const isSelected = selected === option.value;
        return (
          <div key={option.id}>
            <button
              onClick={() => handleSelect(option.value)}
              className="
                w-full px-5 py-4 text-left text-sm leading-relaxed
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
                color: isSelected
                  ? "var(--runner-selected-text)"
                  : "var(--runner-text)",
                boxShadow: isSelected ? "var(--runner-selected-shadow)" : "none",
                fontWeight: isSelected ? "600" : "400",
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

            {/* Hairline "or" divider between the two options */}
            {idx === 0 && choices.length > 1 && (
              <div className="flex items-center gap-3 py-2">
                <div
                  className="h-px flex-1"
                  style={{ background: "var(--runner-hairline)" }}
                />
                <span
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--runner-overline)" }}
                >
                  or
                </span>
                <div
                  className="h-px flex-1"
                  style={{ background: "var(--runner-hairline)" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
