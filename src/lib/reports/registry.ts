// =============================================================================
// src/lib/reports/registry.ts — Block metadata registry
// =============================================================================

import type { BlockType, BlockCategory, BlockConfig } from './types'
import type { PresentationMode, ChartType } from './presentation'

export interface BlockMeta {
  label: string
  category: BlockCategory
  description: string
  defaultConfig: Record<string, unknown>
  supportedModes: PresentationMode[]
  supportedCharts?: ChartType[]
  defaultMode: PresentationMode
  status?: 'hidden' | 'deferred'
}

export const BLOCK_REGISTRY: Record<BlockType, BlockMeta> = {
  cover_page: {
    label: 'Cover Page',
    category: 'meta',
    description: 'Participant name, campaign title, date, and partner logo.',
    defaultConfig: { showDate: true, subtitle: null, showLogo: true, showPoweredBy: false, poweredByText: 'Powered by Trajectas', showAssessmentName: true, showCampaignName: false, showReportName: false },
    supportedModes: ['featured'],
    defaultMode: 'featured',
  },
  custom_text: {
    label: 'Custom Text',
    category: 'meta',
    description: 'Admin-authored freeform text or instructions. Supports markdown.',
    defaultConfig: { heading: '', content: '' },
    supportedModes: ['open', 'inset', 'featured'],
    defaultMode: 'open',
  },
  section_divider: {
    label: 'Section Divider',
    category: 'meta',
    description: 'Visual break between report sections.',
    defaultConfig: { style: 'thin_rule' },
    supportedModes: [],
    defaultMode: 'open',
  },
  score_overview: {
    label: 'Score Overview',
    category: 'score',
    description: 'Radar or bar chart across all factors or dimensions.',
    defaultConfig: { displayLevel: 'factor', groupByDimension: true, showDimensionScore: true, showScore: true, showBandLabel: true },
    supportedModes: ['featured', 'open', 'split'],
    supportedCharts: ['bar', 'radar', 'gauges', 'scorecard'],
    defaultMode: 'open',
  },
  score_detail: {
    label: 'Score Detail',
    category: 'score',
    description: 'One or more entity scores with band labels, definitions, indicators, and development suggestions.',
    defaultConfig: { displayLevel: 'factor', entityIds: [], showScore: true, showBandLabel: true, showDefinition: true, showDescription: false, showIndicators: true, showDevelopment: false, showNestedScores: false, nestedLabel: 'Factors' },
    supportedModes: ['featured', 'open', 'carded', 'split'],
    defaultMode: 'open',
  },
  score_interpretation: {
    label: 'Score Interpretation',
    category: 'score',
    description: 'Compact consultant reference: scores with bars, band labels, and low/high anchor sentences.',
    defaultConfig: { displayLevel: 'factor', groupByDimension: true, showScore: true, showBandLabel: true, showAnchors: true },
    supportedModes: ['open', 'featured'],
    defaultMode: 'open',
  },
  score_interpretation_v2: {
    label: 'Score Interpretation (Compact)',
    category: 'score',
    description: 'Compact consultant reference with flanking anchors, band-break ticks, and independent parent/child toggles.',
    defaultConfig: {
      displayLevel: 'factor',
      groupByDimension: true,
      showScore: true,
      showBandLabel: true,
      showAnchorLow: true,
      showAnchorHigh: true,
    },
    supportedModes: ['open', 'featured'],
    defaultMode: 'open',
  },
  strengths_highlights: {
    label: 'Strengths Highlights',
    category: 'highlight',
    description: 'Top N entities by score with hero visual treatment.',
    defaultConfig: { topN: 3, displayLevel: 'factor' },
    supportedModes: ['featured', 'open', 'carded', 'split'],
    defaultMode: 'carded',
  },
  development_plan: {
    label: 'Development Plan',
    category: 'highlight',
    description: 'Aggregated development suggestions prioritised by lowest score.',
    defaultConfig: { maxItems: 3, prioritiseByScore: true },
    supportedModes: ['open', 'carded', 'split'],
    defaultMode: 'carded',
  },
  ai_text: {
    label: 'AI Text',
    category: 'ai',
    description: 'AI-generated narrative content from the prompt library.',
    defaultConfig: { promptId: '' },
    supportedModes: ['open', 'featured', 'inset'],
    defaultMode: 'open',
  },
  norm_comparison: {
    label: 'Norm Comparison',
    category: 'score',
    description: 'Percentile/sten rank against norm group. Deferred — requires norm group assignment.',
    defaultConfig: { _deferred: true },
    supportedModes: ['open', 'carded', 'split'],
    supportedCharts: ['bar', 'segment', 'scorecard'],
    defaultMode: 'carded',
    status: 'deferred',
  },
  rater_comparison: {
    label: 'Rater Comparison',
    category: '360',
    description: 'Grouped bars: self vs manager vs peers vs direct reports.',
    defaultConfig: { raterGroups: ['self', 'manager', 'peers', 'direct_reports'] },
    supportedModes: ['open', 'carded', 'split'],
    supportedCharts: ['grouped_bar', 'radar_360'],
    defaultMode: 'open',
    status: 'deferred',
  },
  gap_analysis: {
    label: 'Gap Analysis',
    category: '360',
    description: 'Blind spots (self high, others low) and hidden strengths (self low, others high).',
    defaultConfig: { gapThreshold: 20, showBlindSpots: true, showHiddenStrengths: true },
    supportedModes: ['open', 'split', 'inset'],
    supportedCharts: ['gap'],
    defaultMode: 'open',
    status: 'deferred',
  },
  open_comments: {
    label: 'Open Comments',
    category: '360',
    description: 'Aggregated qualitative feedback from raters. Anonymity floor: min 3 raters.',
    defaultConfig: { minRatersForDisplay: 3, groupByFactor: true },
    supportedModes: ['open', 'inset'],
    defaultMode: 'open',
    status: 'deferred',
  },
}

export const BLOCK_CATEGORIES: Record<BlockCategory, { label: string; order: number }> = {
  meta: { label: 'Layout & Text', order: 1 },
  score: { label: 'Score Blocks', order: 2 },
  highlight: { label: 'Highlights', order: 3 },
  ai: { label: 'AI Content', order: 3.5 },
  '360': { label: '360 Blocks', order: 4 },
}

export function isDeferredBlockType(type: BlockType): boolean {
  return BLOCK_REGISTRY[type].status === 'deferred'
}

export function getBuilderBlockEntries(reportType: 'self_report' | '360') {
  return (Object.entries(BLOCK_REGISTRY) as Array<[BlockType, BlockMeta]>).filter(
    ([, meta]) =>
      meta.status !== 'deferred' &&
      meta.status !== 'hidden' &&
      (reportType === '360' || meta.category !== '360'),
  )
}

/** Parse and validate template blocks JSONB into typed BlockConfig array. */
export function parseBlocks(raw: Record<string, unknown>[]): BlockConfig[] {
  return raw
    .filter((b) => typeof b.type === 'string' && b.type in BLOCK_REGISTRY)
    .map((b) => {
      const block = b as unknown as BlockConfig
      const meta = BLOCK_REGISTRY[block.type]
      // Set default presentation mode if missing
      if (!block.presentationMode) {
        block.presentationMode = meta.defaultMode
      }
      // Set default chart type if missing and block supports charts
      if (!block.chartType && meta.supportedCharts?.length) {
        block.chartType = (block.config as Record<string, unknown>)?.chartType as ChartType
          ?? meta.supportedCharts[0]
      }
      return block
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}
