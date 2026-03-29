"use client";

import { useState } from "react";

interface ForcedChoiceResponseProps {
  options: { id: string; label: string; value: number }[];
  selectedValue?: number;
  onSelect: (value: number, data: Record<string, unknown>) => void;
  responseData?: Record<string, unknown>;
}

/**
 * Forced choice response format.
 *
 * Two statement cards with an "or" divider.
 * Participant selects one statement as "most like me" — single tap auto-advances.
 * Uses brand tokens for selection state.
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
              className={`
                w-full rounded-xl border-2 px-5 py-5 text-left text-sm leading-relaxed
                transition-all duration-150 ease-out
                focus-visible:outline-none focus-visible:ring-2
                min-h-[44px]
                ${isSelected ? "scale-[1.01]" : "hover:scale-[1.005]"}
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
              <span className={isSelected ? "font-medium" : ""}>
                {option.label}
              </span>
            </button>

            {/* "or" divider between the two options */}
            {idx === 0 && choices.length > 1 && (
              <div className="flex items-center gap-3 py-2">
                <div
                  className="h-px flex-1"
                  style={{ background: "var(--brand-neutral-200, hsl(var(--border)))" }}
                />
                <span
                  className="text-xs font-medium uppercase tracking-wider"
                  style={{ color: "var(--brand-neutral-400, hsl(var(--muted-foreground)))" }}
                >
                  or
                </span>
                <div
                  className="h-px flex-1"
                  style={{ background: "var(--brand-neutral-200, hsl(var(--border)))" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
