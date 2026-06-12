// =============================================================================
// src/lib/reports/pagination.ts — the measured pagination pass (pure core).
//
// Maps a continuous column of rendered report content onto A4 pages using the
// same greedy semantics as CSS fragmentation with our break rules:
//   - flow content fills pages top to bottom
//   - atomic units (.report-entry, keep-together chapters) never straddle a
//     boundary — if one would, it is pushed to the next page
//   - breakBefore/breakAfter force page boundaries (printBreakBefore, cover)
//   - full-page units (the cover) consume exactly one page regardless of
//     their measured on-screen height
//
// Callers measure DOM units (screen space) and hand them here; the result
// powers the builder page-count chip, on-canvas break indicators, and the
// contents block's page numbers (computed at exact A4 metrics in the print
// route, so the PDF's TOC matches its real pagination).
// =============================================================================

/** A4 at 96dpi — matches the Puppeteer viewport and zero-margin page.pdf(). */
export const A4_PAGE_HEIGHT_PX = 1123
export const A4_PAGE_WIDTH_PX = 794

/** Measurement tolerance — sub-pixel layout jitter must not flip a break. */
const EPS = 1

/**
 * When an atomic unit is pushed to a fresh page, the section header directly
 * above it travels too (print CSS: .report-block-headers has break-after:
 * avoid). A TOC target recorded within this many px above the pushed unit is
 * therefore re-anchored to the new page — roughly eyebrow + heading +
 * description height.
 */
const KEEP_WITH_NEXT_WINDOW = 160

export interface PageUnit {
  /** Distance from the report root's top, px (screen space). */
  top: number
  height: number
  /** May not straddle a page boundary — pushed to the next page if it would. */
  atomic?: boolean
  /** Starts on a fresh page (printBreakBefore / chapterFlow new_page). */
  breakBefore?: boolean
  /** The next content starts on a fresh page (cover's break-after). */
  breakAfter?: boolean
  /** Occupies exactly one page regardless of measured height (cover). */
  fullPage?: boolean
  /** Contents-section anchor this unit starts (block id or `dim:<id>`). */
  targetId?: string
}

export interface PageMap {
  pageCount: number
  /** Screen-space y offsets where pages 2..N begin — for break indicators. */
  breakOffsets: number[]
  /** targetId → 1-based page number. */
  pageByTarget: Record<string, number>
}

export function computePageMap(
  units: PageUnit[],
  pageHeight: number,
  totalHeight: number,
): PageMap {
  if (!Number.isFinite(pageHeight) || pageHeight <= 0) {
    return { pageCount: 1, breakOffsets: [], pageByTarget: {} }
  }

  const sorted = [...units].sort((a, b) => a.top - b.top)
  const breakOffsets: number[] = []
  const pageByTarget: Record<string, number> = {}

  let page = 1
  let pageStart = 0
  let pageEnd = pageHeight
  let forceBreakNext = false
  let lastTarget: { id: string; top: number } | null = null

  const startNewPageAt = (y: number) => {
    breakOffsets.push(y)
    page += 1
    pageStart = y
    pageEnd = y + pageHeight
  }

  for (const unit of sorted) {
    if (forceBreakNext) {
      // The previous unit demanded a fresh page for whatever follows.
      if (unit.top > pageStart + EPS) startNewPageAt(unit.top)
      forceBreakNext = false
    } else {
      // Flow content may already have run past one or more boundaries.
      while (unit.top >= pageEnd - EPS) startNewPageAt(pageEnd)

      const atPageStart = unit.top <= pageStart + EPS
      if ((unit.breakBefore || unit.fullPage) && !atPageStart) {
        startNewPageAt(unit.top)
      } else if (
        unit.atomic &&
        !unit.fullPage &&
        unit.top + unit.height > pageEnd + EPS &&
        unit.height <= pageHeight
      ) {
        // Would straddle the boundary — push to the next page. If the push
        // happens right at the top of a section (only its header rendered so
        // far), the header travels with the pushed entry, so the section's
        // TOC target moves to the new page too.
        startNewPageAt(unit.top)
        if (lastTarget && lastTarget.top >= unit.top - KEEP_WITH_NEXT_WINDOW) {
          pageByTarget[lastTarget.id] = page
        }
      }
    }

    if (unit.targetId && !(unit.targetId in pageByTarget)) {
      pageByTarget[unit.targetId] = page
      lastTarget = { id: unit.targetId, top: unit.top }
    }

    if (unit.breakAfter || unit.fullPage) forceBreakNext = true
  }

  // Trailing flow content beyond the last unit.
  while (totalHeight > pageEnd + EPS) startNewPageAt(pageEnd)

  return { pageCount: page, breakOffsets, pageByTarget }
}
