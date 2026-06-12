'use client'

// =============================================================================
// PrintPaginatedReport — wraps ReportRenderer for the print routes, runs the
// measured pagination pass at exact A4 metrics (the Puppeteer viewport is
// 794×1123 with print media emulated), and provides the PageMap so the
// contents block can render real TOC page numbers into the PDF.
//
// Sets data-pagination-ready on <html> once the map is applied; pdf.ts waits
// for it (soft timeout) before printing.
// =============================================================================

import { useEffect, useRef, useState } from 'react'
import { ReportRenderer } from './report-renderer'
import { PageMapContext, measurePageUnits } from './page-map'
import { computePageMap, A4_PAGE_HEIGHT_PX, type PageMap } from '@/lib/reports/pagination'
import type { ResolvedBlockData } from '@/lib/reports/types'

export function PrintPaginatedReport({
  blocks,
  className,
}: {
  blocks: ResolvedBlockData[]
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pageMap, setPageMap] = useState<PageMap | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        await document.fonts?.ready
      } catch {
        // fonts API unavailable — measure anyway
      }
      if (cancelled || !ref.current) return
      const units = measurePageUnits(ref.current)
      setPageMap(computePageMap(units, A4_PAGE_HEIGHT_PX, ref.current.scrollHeight))
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [blocks])

  // Second effect: the map is applied (TOC numbers rendered) — signal Puppeteer.
  useEffect(() => {
    if (pageMap) {
      document.documentElement.setAttribute('data-pagination-ready', 'true')
    }
  }, [pageMap])

  return (
    <PageMapContext.Provider value={pageMap}>
      <div ref={ref}>
        <ReportRenderer blocks={blocks} className={className} />
      </div>
    </PageMapContext.Provider>
  )
}
