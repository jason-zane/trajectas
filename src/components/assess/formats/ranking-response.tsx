"use client";

import { useState } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import { GripVertical, ChevronUp, ChevronDown } from "lucide-react";

interface RankingResponseProps {
  options: { id: string; label: string; value: number }[];
  selectedValue?: number;
  onSelect: (value: number, data: Record<string, unknown>) => void;
  responseData?: Record<string, unknown>;
}

interface SortableItemProps {
  id: string;
  index: number;
  label: string;
  rank: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function SortableItem({
  id,
  index,
  label,
  rank,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: SortableItemProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id,
    index,
  });

  return (
    <div
      ref={ref}
      className="
        flex items-center gap-3 px-4 py-3.5
        transition-all duration-150
      "
      style={{
        borderRadius: "10px",
        border: "1px solid",
        borderColor: isDragging
          ? "var(--runner-selected-fill)"
          : "var(--runner-ghost-border)",
        backgroundColor: isDragging
          ? "var(--runner-selected-fill)"
          : "var(--runner-ghost-fill)",
        boxShadow: isDragging ? "var(--runner-selected-shadow)" : "none",
        opacity: isDragging ? 0.8 : 1,
      }}
    >
      <button
        ref={handleRef}
        type="button"
        className="shrink-0 cursor-grab touch-none active:cursor-grabbing transition-colors"
        style={{ color: "var(--runner-text-faint)" }}
        aria-label={`Drag to reorder ${label}`}
      >
        <GripVertical className="size-4" />
      </button>
      <span
        className="flex size-6 shrink-0 items-center justify-center text-xs font-semibold"
        style={{
          fontFamily: '"Geist Mono", ui-monospace, monospace',
          letterSpacing: "0.08em",
          color: "var(--runner-text-muted)",
        }}
      >
        {rank}
      </span>
      <span
        className="flex-1 text-sm"
        style={{ color: "var(--runner-text)" }}
      >
        {label}
      </span>
      {/* Arrow fallback for accessibility / non-drag interaction */}
      <div className="flex flex-col gap-0">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="p-0.5 transition-colors hover:opacity-100 disabled:opacity-30"
          style={{ color: "var(--runner-text-faint)" }}
          aria-label={`Move ${label} up`}
        >
          <ChevronUp className="size-4" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="p-0.5 transition-colors hover:opacity-100 disabled:opacity-30"
          style={{ color: "var(--runner-text-faint)" }}
          aria-label={`Move ${label} down`}
        >
          <ChevronDown className="size-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Ranking (drag-to-reorder) response format (dark-editorial re-skin).
 *
 * Shows a sortable list with grip handles (lucide grip-vertical in --runner-text-faint).
 * Hairline-divided rows with mono rank number (--runner-text-muted); arrow fallback buttons.
 * Dragging row lifts with --runner-selected-shadow.
 * Does NOT auto-advance -- requires Continue button (handled by parent).
 * Uses @dnd-kit/react for drag-and-drop.
 * Uses --runner-* custom properties exclusively.
 */
export function RankingResponse({
  options,
  onSelect,
  responseData,
}: RankingResponseProps) {
  const initialOrder =
    (responseData?.ranking as number[]) ?? options.map((o) => o.value);
  const [ranking, setRanking] = useState<number[]>(initialOrder);

  const optionMap = new Map(options.map((o) => [o.value, o]));

  // Build items for rendering
  const items = ranking.map((value) => {
    const option = optionMap.get(value);
    return {
      id: option?.id ?? String(value),
      value,
      label: option?.label ?? "",
    };
  });

  function swapItems(fromIdx: number, toIdx: number) {
    setRanking((prev) => {
      const next = [...prev];
      [next[fromIdx], next[toIdx]] = [next[toIdx], next[fromIdx]];
      onSelect(next[0], { ranking: next });
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <p
        className="mb-3 text-xs font-semibold uppercase tracking-widest"
        style={{
          fontFamily: '"Geist Mono", ui-monospace, monospace',
          color: "var(--runner-overline)",
        }}
      >
        Drag or use arrows to rank from most to least preferred
      </p>
      <DragDropProvider
        onDragEnd={(event) => {
          setRanking((prev) => {
            const next = move(prev, event) as number[];
            onSelect(next[0], { ranking: next });
            return next;
          });
        }}
      >
        <div className="space-y-2">
          {items.map((item, index) => (
            <SortableItem
              key={item.id}
              id={item.id}
              index={index}
              label={item.label}
              rank={index + 1}
              isFirst={index === 0}
              isLast={index === items.length - 1}
              onMoveUp={() => {
                if (index > 0) swapItems(index, index - 1);
              }}
              onMoveDown={() => {
                if (index < items.length - 1) swapItems(index, index + 1);
              }}
            />
          ))}
        </div>
      </DragDropProvider>
    </div>
  );
}
