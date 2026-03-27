"use client";

import { useState } from "react";

interface ForcedChoiceResponseProps {
  options: { id: string; label: string; value: number }[];
  selectedValue?: number;
  onSelect: (value: number, data: Record<string, unknown>) => void;
  responseData?: Record<string, unknown>;
}

export function ForcedChoiceResponse({
  options,
  selectedValue,
  onSelect,
  responseData,
}: ForcedChoiceResponseProps) {
  const [mostLike, setMostLike] = useState<number | undefined>(
    responseData?.mostLike as number | undefined,
  );
  const [leastLike, setLeastLike] = useState<number | undefined>(
    responseData?.leastLike as number | undefined,
  );

  function handleMost(value: number) {
    const newMost = value;
    setMostLike(newMost);
    if (leastLike !== undefined) {
      onSelect(newMost, { mostLike: newMost, leastLike });
    }
  }

  function handleLeast(value: number) {
    const newLeast = value;
    setLeastLike(newLeast);
    if (mostLike !== undefined) {
      onSelect(mostLike, { mostLike, leastLike: newLeast });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
          Most like me
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((o) => {
            const sel = mostLike === o.value;
            const disabled = leastLike === o.value;
            return (
              <button
                key={`most-${o.id}`}
                onClick={() => handleMost(o.value)}
                disabled={disabled}
                className={`rounded-xl border-2 px-4 py-3 text-sm text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  sel
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : disabled
                      ? "border-border/50 bg-muted/30 text-muted-foreground cursor-not-allowed"
                      : "border-border bg-card hover:border-primary/50"
                }`}
                aria-pressed={sel}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
          Least like me
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((o) => {
            const sel = leastLike === o.value;
            const disabled = mostLike === o.value;
            return (
              <button
                key={`least-${o.id}`}
                onClick={() => handleLeast(o.value)}
                disabled={disabled}
                className={`rounded-xl border-2 px-4 py-3 text-sm text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  sel
                    ? "border-destructive bg-destructive/10 text-destructive font-medium"
                    : disabled
                      ? "border-border/50 bg-muted/30 text-muted-foreground cursor-not-allowed"
                      : "border-border bg-card hover:border-destructive/50"
                }`}
                aria-pressed={sel}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
