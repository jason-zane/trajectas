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
import { AiTextBlock } from './blocks/ai-text'
import { ModeWrapper } from './modes/mode-wrapper'
import type { ResolvedBlockData, BlockType } from '@/lib/reports/types'
import type { PresentationMode, ChartType, ReportTheme } from '@/lib/reports/presentation'

type BlockComponent = (props: {
  data: Record<string, unknown>
  mode?: PresentationMode
  chartType?: ChartType
}) => React.ReactElement | null

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
  ai_text: AiTextBlock,
}

function themeToStyle(theme: ReportTheme): React.CSSProperties {
  const style: Record<string, string> = {}
  for (const [key, value] of Object.entries(theme)) {
    const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`
    style[cssVar] = value
  }
  return style as React.CSSProperties
}

interface ReportRendererProps {
  blocks: ResolvedBlockData[]
  className?: string
}

export function ReportRenderer({ blocks, className }: ReportRendererProps) {
  const searchParams = useSearchParams()
  const isPrint = searchParams.get('format') === 'print'

  // Extract resolved brand theme from the first block that has it
  const brandTheme = blocks.find((b) => b.resolvedBrandTheme)?.resolvedBrandTheme

  return (
    <div
      data-print={isPrint ? 'true' : undefined}
      className={className}
      style={brandTheme ? themeToStyle(brandTheme) : undefined}
    >
      {blocks
        .filter((block) => !block.skipped)
        .filter((block) => (isPrint ? !block.printHide : !block.screenHide))
        .map((block) => {
          const Component = BLOCK_COMPONENTS[block.type]
          if (!Component) return null

          const mode = block.presentationMode ?? 'open'

          // Section dividers render directly without mode wrapper
          if (block.type === 'section_divider') {
            return (
              <Component
                key={block.blockId}
                data={block.data}
                mode={mode}
                chartType={block.chartType}
              />
            )
          }

          const hasHeaders = block.eyebrow || block.heading || block.blockDescription

          return (
            <div key={block.blockId} className={block.printBreakBefore ? 'print:break-before-page' : undefined}>
              {hasHeaders && (
                <div className="px-10 pt-9 space-y-1.5">
                  {block.eyebrow && (
                    <p
                      className="text-[10px] uppercase tracking-[2px]"
                      style={{ color: 'var(--report-label-colour)' }}
                    >
                      {block.eyebrow}
                    </p>
                  )}
                  {block.heading && (
                    <h2
                      className="text-xl font-semibold"
                      style={{ color: 'var(--report-heading-colour)' }}
                    >
                      {block.heading}
                    </h2>
                  )}
                  {block.blockDescription && (
                    <p
                      className="text-sm"
                      style={{ color: 'var(--report-muted-colour)' }}
                    >
                      {block.blockDescription}
                    </p>
                  )}
                </div>
              )}
              <ModeWrapper
                mode={mode}
                columns={block.columns}
                insetAccent={block.insetAccent}
              >
                <Component data={block.data} mode={mode} chartType={block.chartType} />
              </ModeWrapper>
            </div>
          )
        })}
    </div>
  )
}
