"use client";

import { useCallback, useRef, useState } from "react";

interface CognitiveOption {
  id: string;
  label: string;
  value: number;
  /** Server-rendered SVG markup for this option's tile. Absent only if the
   *  item's cognitive spec failed to load — falls back to a plain label. */
  optionSvg?: string;
}

interface CognitiveStimulus {
  /** Inline SVG markup for the 8 real grid cells (blank cell is UI chrome — see below). */
  gridSvg: string;
  /** Honest accessibility identification, not a cell-by-cell description. */
  ariaLabel: string;
}

interface CognitiveResponseProps {
  stimulus?: CognitiveStimulus;
  options: CognitiveOption[];
  selectedValue?: number;
  onSelect: (value: number) => void;
}

/**
 * Figural-matrix (LR-M) response format (dark-editorial re-skin).
 *
 * 3x3 stimulus grid (server-rendered SVG, inlined) above the option tiles,
 * the whole block centred and sized against the viewport HEIGHT as well as
 * width — the first pilot sitting had to scroll to see the options, which
 * on a timed test costs seconds per item and hides the answer set while the
 * puzzle is being read. `--cog-size` caps the grid at min(420px, 88vw,
 * 44dvh). The option row has its OWN width budget (JH, v3 pilot feedback:
 * tiles sized to a sixth of the grid width were too small to read) — it may
 * run wider than the grid, up to min(92vw, 700px, 96dvh) for six options,
 * so a desktop shows one generous row of six under a narrower puzzle, and a
 * phone below 640 px wraps 3+3 at near-grid-cell size. Height still
 * governs: the dvh term shrinks tiles before anything scrolls.
 * Options form a `radiogroup`: click/tap or Enter/Space selects; arrow keys
 * move focus between tiles (Left/Right walk the row; Up/Down move by the
 * RENDERED column count — 3 in the wrapped phone layout, the full row
 * width otherwise, where they wrap to the same tile; N is 5 for items
 * generated before v3 and 6 from v3 on). Selecting
 * auto-advances like every other single-select format — `cognitive` is in
 * section-wrapper.tsx's `AUTO_ADVANCE_FORMATS` — provided the section allows
 * back-nav, which is what makes a slipped tap recoverable (doc 03 §7.3's
 * concern). In a section with `allow_back_nav = false` the wrapper falls back
 * to the explicit tap + Continue step instead.
 *
 * The blank R3C3 "?" placeholder is rendered here as ordinary UI chrome, not
 * spec-derived content — it is the same for every figural-matrix item, so it
 * stays outside the deterministic-content boundary the renderer guarantees
 * (see src/lib/cognitive/render/matrix-svg.ts). It occupies the grid's 9th
 * CSS-grid slot via the `display: contents` wrapper around the injected
 * `gridSvg`, which makes its 8 `.cog-cell` children participate directly in
 * this component's 3-column grid alongside the marker.
 *
 * Safety of `dangerouslySetInnerHTML`: both `gridSvg` and each `optionSvg`
 * are produced server-side by a pure renderer reading a zod-`.strict()`-
 * validated, closed vocabulary — no free text, no user input, no
 * admin-authored HTML. See the safety argument in
 * docs/superpowers/specs/2026-08-13-logical-reasoning-build-plan/
 * 02-platform-architecture.md §2.4.
 */
export function CognitiveResponse({
  stimulus,
  options,
  selectedValue,
  onSelect,
}: CognitiveResponseProps) {
  const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const initialActive = Math.max(
    0,
    options.findIndex((o) => o.value === selectedValue),
  );
  const [activeIndex, setActiveIndex] = useState(initialActive);

  const optionCount = options.length;
  /**
   * The number of grid columns the option row is RENDERED with, so vertical
   * arrows move between visible rows (codex review, PR #369): six options
   * wrap 3+3 under the 640 px breakpoint (the sm: classes below); five
   * options and six-in-one-row keep a single row, where a vertical arrow
   * wraps to the same tile (the pre-v3 behaviour). Read at event time — a
   * resize between keydowns must not act on a stale column count.
   */
  const renderedColumns = useCallback(() => {
    if (optionCount === 6 && typeof window !== "undefined" && !window.matchMedia("(min-width: 640px)").matches) {
      return 3;
    }
    return optionCount;
  }, [optionCount]);
  const focusTile = useCallback(
    (index: number) => {
      if (options.length === 0) return;
      const clamped = ((index % options.length) + options.length) % options.length;
      tileRefs.current[clamped]?.focus();
    },
    [options.length],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      switch (event.key) {
        case "ArrowRight":
          event.preventDefault();
          focusTile(index + 1);
          break;
        case "ArrowLeft":
          event.preventDefault();
          focusTile(index - 1);
          break;
        case "ArrowDown":
          event.preventDefault();
          focusTile(index + renderedColumns());
          break;
        case "ArrowUp":
          event.preventDefault();
          focusTile(index - renderedColumns());
          break;
        default:
          break;
      }
    },
    [focusTile, renderedColumns],
  );

  return (
    <div
      className="mx-auto flex flex-col items-center gap-5"
      style={{ "--cog-size": "min(420px, 88vw, 44dvh)" } as React.CSSProperties}
    >
      {stimulus && (
        <div
          role="img"
          aria-label={stimulus.ariaLabel}
          className="grid grid-cols-3 gap-1.5 sm:gap-2"
          style={{ width: "var(--cog-size)" }}
        >
          <div
            style={{ display: "contents" }}
            dangerouslySetInnerHTML={{ __html: stimulus.gridSvg }}
          />
          <div
            aria-hidden="true"
            className="flex items-center justify-center text-2xl font-semibold"
            style={{
              aspectRatio: "1 / 1",
              borderRadius: "6px",
              border: "1px dashed var(--runner-ghost-border)",
              color: "var(--runner-text-faint)",
            }}
          >
            ?
          </div>
        </div>
      )}

      <div
        role="radiogroup"
        aria-label="Answer options"
        className={
          options.length === 6
            ? "grid w-full grid-cols-3 gap-2.5 sm:grid-cols-6"
            : "grid w-full grid-cols-5 gap-2.5"
        }
        style={{
          // The row's own budget — deliberately wider than the puzzle grid.
          // Width caps the tiles on wide screens; the dvh term caps them on
          // short screens so the block never scrolls; 92vw floors the phone.
          maxWidth:
            options.length === 6
              ? "min(92vw, 700px, 96dvh)"
              : "min(92vw, 600px, 82dvh)",
        }}
      >
        {options.map((option, index) => {
          const isSelected = selectedValue === option.value;
          const isTabStop = selectedValue !== undefined ? isSelected : index === activeIndex;
          return (
            <button
              key={option.id}
              ref={(el) => {
                tileRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Option ${option.label}`}
              tabIndex={isTabStop ? 0 : -1}
              onFocus={() => setActiveIndex(index)}
              onClick={() => onSelect(option.value)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className="
                flex items-center justify-center p-2
                transition-all duration-150 ease-out
                hover:scale-[1.03] hover:shadow-lg
                focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--runner-page)]
                active:scale-95
              "
              style={{
                aspectRatio: "1 / 1",
                borderRadius: "12px",
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
            >
              {option.optionSvg ? (
                <div
                  className="size-full"
                  dangerouslySetInnerHTML={{ __html: option.optionSvg }}
                />
              ) : (
                <span
                  style={{
                    color: isSelected
                      ? "var(--runner-selected-text)"
                      : "var(--runner-text)",
                  }}
                >
                  {option.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
