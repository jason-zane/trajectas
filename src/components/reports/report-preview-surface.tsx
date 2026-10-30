import type { ReactNode } from 'react'
import type { ResolvedBlockData } from '@/lib/reports/types'

/** Match the visible surface to an A4 report's width, with no spare white
 * column. Other report layouts keep their existing available width. */
export function ReportPreviewSurface({ blocks, children }: { blocks: ResolvedBlockData[]; children: ReactNode }) {
  const a4 = blocks.some(block => block.type === 'custom' && !block.skipped && (block.data as { slug?: string }).slug === 'trajectas-personality-standard-v1')
  return <div className={`mx-auto overflow-x-auto rounded-xl border border-border bg-card ${a4 ? 'w-full max-w-[796px]' : ''}`}>{children}</div>
}
