'use client'

import { useSearchParams } from 'next/navigation'
import { CoverPageBlock } from './blocks/cover-page'
import { CustomTextBlock } from './blocks/custom-text'
import { SectionDividerBlock } from './blocks/section-divider'
import { ScoreOverviewBlock } from './blocks/score-overview'
import { ScoreDetailBlock } from './blocks/score-detail'
import { StrengthsHighlightsBlock } from './blocks/strengths-highlights'
import { DevelopmentPlanBlock } from './blocks/development-plan'
import { NormComparisonBlock } from './blocks/norm-comparison'
import { RaterComparisonBlock } from './blocks/rater-comparison'
import { GapAnalysisBlock } from './blocks/gap-analysis'
import { OpenCommentsBlock } from './blocks/open-comments'
import type { ResolvedBlockData, BlockType } from '@/lib/reports/types'

type BlockComponent = (props: { data: Record<string, unknown> }) => React.ReactElement | null

const BLOCK_COMPONENTS: Record<BlockType, BlockComponent> = {
  cover_page: CoverPageBlock,
  custom_text: CustomTextBlock,
  section_divider: SectionDividerBlock,
  score_overview: ScoreOverviewBlock,
  score_detail: ScoreDetailBlock,
  strengths_highlights: StrengthsHighlightsBlock,
  development_plan: DevelopmentPlanBlock,
  norm_comparison: NormComparisonBlock,
  rater_comparison: RaterComparisonBlock,
  gap_analysis: GapAnalysisBlock,
  open_comments: OpenCommentsBlock,
}

interface ReportRendererProps {
  blocks: ResolvedBlockData[]
  className?: string
}

export function ReportRenderer({ blocks, className }: ReportRendererProps) {
  const searchParams = useSearchParams()
  const isPrint = searchParams.get('format') === 'print'

  return (
    <div
      data-print={isPrint ? 'true' : undefined}
      className={`space-y-8 ${className ?? ''}`}
    >
      {blocks
        .filter((block) => !block.skipped)
        .filter((block) => isPrint ? !block.printHide : !block.screenHide)
        .map((block) => {
          const Component = BLOCK_COMPONENTS[block.type]
          if (!Component) return null

          return (
            <div
              key={block.blockId}
              className={block.printBreakBefore ? 'print:break-before-page' : ''}
            >
              <Component data={block.data} />
            </div>
          )
        })}
    </div>
  )
}
