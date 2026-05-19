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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
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
