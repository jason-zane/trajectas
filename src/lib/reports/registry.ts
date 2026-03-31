// =============================================================================
// src/lib/reports/registry.ts — Block metadata registry
// =============================================================================

import type { BlockType, BlockCategory, BlockConfig } from './types'

export interface BlockMeta {
  label: string
  category: BlockCategory
  description: string
  defaultConfig: Record<string, unknown>
  is360Only?: boolean
  isDeferred?: boolean
}

export const BLOCK_REGISTRY: Record<BlockType, BlockMeta> = {
  cover_page: {
    label: 'Cover Page',
    category: 'meta',
    description: 'Participant name, campaign title, date, and partner logo.',
    defaultConfig: { showDate: true, showLogo: true },
  },
  custom_text: {
    label: 'Custom Text',
    category: 'meta',
    description: 'Admin-authored freeform text or instructions. Supports markdown.',
    defaultConfig: { heading: '', content: '' },
  },
  section_divider: {
    label: 'Section Divider',
    category: 'meta',
    description: 'Visual break with title and optional subtitle.',
    defaultConfig: { title: 'Section Title' },
  },
  score_overview: {
    label: 'Score Overview',
    category: 'score',
    description: 'Radar or bar chart across all factors or dimensions.',
    defaultConfig: { chartType: 'radar', displayLevel: 'factor', groupByDimension: true, showDimensionScore: true },
  },
  score_detail: {
    label: 'Score Detail',
    category: 'score',
    description: 'Single entity score with band label, definition, indicators, and development suggestion.',
    defaultConfig: { displayLevel: 'factor', entityId: null, showScore: true, showBandLabel: true, showDefinition: true, showIndicators: true, showDevelopment: false, showChildBreakdown: false },
  },
  strengths_highlights: {
    label: 'Strengths Highlights',
    category: 'highlight',
    description: 'Top N entities by score with hero visual treatment.',
    defaultConfig: { topN: 3, displayLevel: 'factor', style: 'cards' },
  },
  development_plan: {
    label: 'Development Plan',
    category: 'highlight',
    description: 'Aggregated development suggestions prioritised by lowest score.',
    defaultConfig: { maxItems: 3, prioritiseByScore: true },
  },
  norm_comparison: {
    label: 'Norm Comparison',
    category: 'score',
    description: 'Percentile/sten rank against norm group. Deferred — requires norm group assignment.',
    defaultConfig: { _deferred: true },
    isDeferred: true,
  },
  rater_comparison: {
    label: 'Rater Comparison',
    category: '360',
    description: 'Grouped bars: self vs manager vs peers vs direct reports.',
    defaultConfig: { raterGroups: ['self', 'manager', 'peers', 'direct_reports'] },
    is360Only: true,
  },
  gap_analysis: {
    label: 'Gap Analysis',
    category: '360',
    description: 'Blind spots (self high, others low) and hidden strengths (self low, others high).',
    defaultConfig: { gapThreshold: 20, showBlindSpots: true, showHiddenStrengths: true },
    is360Only: true,
  },
  open_comments: {
    label: 'Open Comments',
    category: '360',
    description: 'Aggregated qualitative feedback from raters. Anonymity floor: min 3 raters.',
    defaultConfig: { minRatersForDisplay: 3, groupByFactor: true },
    is360Only: true,
  },
}

export const BLOCK_CATEGORIES: Record<BlockCategory, { label: string; order: number }> = {
  meta: { label: 'Layout & Text', order: 1 },
  score: { label: 'Score Blocks', order: 2 },
  highlight: { label: 'Highlights', order: 3 },
  '360': { label: '360 Blocks', order: 4 },
}

/** Parse and validate template blocks JSONB into typed BlockConfig array. */
export function parseBlocks(raw: Record<string, unknown>[]): BlockConfig[] {
  return raw
    .filter((b) => typeof b.type === 'string' && b.type in BLOCK_REGISTRY)
    .map((b) => b as unknown as BlockConfig)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}
