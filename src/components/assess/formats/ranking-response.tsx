"use client";

import { useState } from "react";
import { GripVertical, ChevronUp, ChevronDown } from "lucide-react";

interface RankingResponseProps {
  options: { id: string; label: string; value: number }[];
  selectedValue?: number;
  onSelect: (value: number, data: Record<string, unknown>) => void;
  responseData?: Record<string, unknown>;
}

export function RankingResponse({
  options,
  onSelect,
  responseData,
}: RankingResponseProps) {
  const initialOrder = (responseData?.ranking as number[]) ?? options.map((o) => o.value);
  const [ranking, setRanking] = useState<number[]>(initialOrder);

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...ranking];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setRanking(next);
    onSelect(next[0], { ranking: next });
  }

  function moveDown(index: number) {
    if (index === ranking.length - 1) return;
    const next = [...ranking];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setRanking(next);
    onSelect(next[0], { ranking: next });
  }

  const optionMap = new Map(options.map((o) => [o.value, o]));

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        Drag or use arrows to rank from most to least preferred.
      </p>
      {ranking.map((value, index) => {
        const option = optionMap.get(value);
        if (!option) return null;
        return (
          <div
            key={option.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors"
          >
            <GripVertical className="size-4 text-muted-foreground/50" />
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {index + 1}
            </span>
            <span className="flex-1 text-sm">{option.label}</span>
            <div className="flex flex-col">
              <button
                onClick={() => moveUp(index)}
                disabled={index === 0}
                className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label={`Move ${option.label} up`}
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                onClick={() => moveDown(index)}
                disabled={index === ranking.length - 1}
                className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label={`Move ${option.label} down`}
              >
                <ChevronDown className="size-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
