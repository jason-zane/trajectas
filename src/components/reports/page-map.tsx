'use client'

// =============================================================================
// Page-map plumbing: the React context that carries a computed PageMap down to
// blocks that care (the contents block renders TOC page numbers from it), and
// the DOM measurement that turns a rendered report into PageUnits.
// =============================================================================

import { createContext, useContext } from 'react'
import type { PageMap, PageUnit } from '@/lib/reports/pagination'

export const PageMapContext = createContext<PageMap | null>(null)

export function usePageMap(): PageMap | null {
  return useContext(PageMapContext)
}

/**
 * Collect PageUnits from a rendered report. Markers come from the renderer
 * and block components:
 *   [data-pg-block]      — block wrapper; carries break flags + toc target
 *   [data-pg-section]    — sub-block section (chapters); toc target + atomic flag
 *   [data-pg-atomic]     — keep-together fragments (chapter heroes)
 *   .report-entry        — atomic score entries (FactorRow & friends)
 */
export function measurePageUnits(root: HTMLElement): PageUnit[] {
  const rootTop = root.getBoundingClientRect().top
  const units: PageUnit[] = []

  const els = root.querySelectorAll<HTMLElement>(
    '[data-pg-block], [data-pg-section], [data-pg-atomic], .report-entry',
  )
  els.forEach((el) => {
    const rect = el.getBoundingClientRect()
    if (rect.height <= 0) return
    const isBlock = el.hasAttribute('data-pg-block')
    const isSection = el.hasAttribute('data-pg-section')
    units.push({
      top: rect.top - rootTop,
      height: rect.height,
      atomic: el.classList.contains('report-entry') || el.hasAttribute('data-pg-atomic'),
      breakBefore: el.hasAttribute('data-pg-break-before'),
      breakAfter: el.hasAttribute('data-pg-break-after'),
      fullPage: el.hasAttribute('data-pg-full-page'),
      targetId:
        (isBlock || isSection) && el.dataset.tocTarget ? el.dataset.tocTarget : undefined,
    })
  })

  return units
}
