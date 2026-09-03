// Root component for the 5Brains custom report — composes 9 A4 pages.

import type { CustomReportRenderContext } from '@/lib/reports/custom'
import type { FiveBrainsReportData } from '@/lib/reports/custom/5brains'
import { CoverPage } from './cover'
import { IntroPage } from './intro'
import { OverviewPage } from './overview'
import { BrainPage } from './brain-page'
import { ClosingPage } from './closing'

export function FiveBrainsReport({
  data,
}: {
  data: FiveBrainsReportData
  ctx: CustomReportRenderContext
}) {
  return (
    <div className="fb-stack" style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
      {/* Print geometry. On screen the pages are a gapped stack; in print that
          24px gap is cumulative drift — nine pages of it pushed ~196px past the
          last A4 boundary and emitted a blank tenth page. In print the stack
          collapses to a plain block and each page breaks explicitly, with the
          last page's break reset so nothing follows it. Page boxes are sized in
          mm so they match the `@page` box exactly rather than the 794x1123px
          screen approximation, which is a shade taller than A4 at 96dpi. */}
      <style>{`
        @media print {
          /* !important is load-bearing: the stack and the page boxes set
             display/gap/width/height as inline styles, which otherwise win. */
          .fb-stack { display: block !important; gap: 0 !important; }
          .fb-page {
            width: 210mm !important;
            height: 297mm !important;
            page-break-after: always;
            break-after: page;
          }
          .fb-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>
      <CoverPage data={data} />
      <IntroPage data={data} pageNum={2} />
      <OverviewPage data={data} pageNum={3} />
      {data.brains.map((brain, i) => (
        <BrainPage key={brain.id} data={data} brain={brain} pageNum={4 + i} />
      ))}
      <ClosingPage data={data} />
    </div>
  )
}
