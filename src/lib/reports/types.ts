// =============================================================================
// src/lib/reports/types.ts — Block engine type system
// =============================================================================

import type { PresentationMode, ChartType, ReportTheme } from './presentation'

// ---------------------------------------------------------------------------
// Block type registry key
// ---------------------------------------------------------------------------

export type BlockType =
  // Meta
  | 'cover_page'
  | 'custom_text'
  | 'section_divider'
  // Score (self-report + 360)
  | 'score_overview'
  | 'score_detail'
  | 'strengths_highlights'
  | 'development_plan'
  | 'norm_comparison'   // registered but deferred — runner skips if included
  // AI
  | 'ai_text'
  // 360-only
  | 'rater_comparison'
  | 'gap_analysis'
  | 'open_comments'

export type BlockCategory = 'meta' | 'score' | 'highlight' | 'ai' | '360'

// ---------------------------------------------------------------------------
// Block condition
// ---------------------------------------------------------------------------

export type BlockCondition =
  | { type: 'hasNormData' }
  | { type: 'has360Data' }
  | { type: 'scoreAbove'; entityId: string; threshold: number }
  | { type: 'scoreBelow'; entityId: string; threshold: number }

// ---------------------------------------------------------------------------
// Per-block config interfaces
// ---------------------------------------------------------------------------

export interface CoverPageConfig {
  showDate?: boolean
  showLogo?: boolean
  showPoweredBy?: boolean
  poweredByText?: string
  subtitle?: string
  showAssessmentName?: boolean
  showCampaignName?: boolean
  showReportName?: boolean
}

export interface CustomTextConfig {
  heading?: string
  content: string   // markdown
}

export interface SectionDividerConfig {
  style: 'thin_rule' | 'thick_rule' | 'whitespace' | 'dot_break'
}

export interface ScoreOverviewConfig {
  displayLevel: 'dimension' | 'factor' | 'construct'
  groupByDimension?: boolean
  showDimensionScore?: boolean
  showScore?: boolean
  showBandLabel?: boolean
  entityIds?: string[]  // null/empty = all scored entities
}

export interface ScoreDetailConfig {
  displayLevel: 'dimension' | 'factor' | 'construct'
  entityIds: string[]                    // multi-entity support
  entityId?: string | null               // deprecated — kept for backward compat
  showScore?: boolean
  showBandLabel?: boolean
  showDefinition?: boolean
  showDescription?: boolean
  showIndicators?: boolean
  showDevelopment?: boolean
  showNestedScores?: boolean
  nestedLabel?: string                   // e.g. "Factors", "Constructs" — label above nested children
}

export interface StrengthsHighlightsConfig {
  topN: number
  displayLevel: 'dimension' | 'factor' | 'construct'
}

export interface DevelopmentPlanConfig {
  maxItems: number
  prioritiseByScore?: boolean
  displayLevel?: 'dimension' | 'factor' | 'construct'
  entityIds?: string[]
}

export interface AiTextConfig {
  promptId: string
}

export interface NormComparisonConfig {
  // deferred — no fields required for v1 stub
  _deferred: true
}

export interface RaterComparisonConfig {
  entityIds?: string[]
  raterGroups: Array<'self' | 'manager' | 'peers' | 'direct_reports'>
}

export interface GapAnalysisConfig {
  gapThreshold?: number   // default 20 (POMP points)
  showBlindSpots?: boolean
  showHiddenStrengths?: boolean
}

export interface OpenCommentsConfig {
  minRatersForDisplay?: number   // default 3
  groupByFactor?: boolean
}

// ---------------------------------------------------------------------------
// BlockConfig — one entry in report_templates.blocks
// ---------------------------------------------------------------------------

export type BlockConfigMap = {
  cover_page: CoverPageConfig
  custom_text: CustomTextConfig
  section_divider: SectionDividerConfig
  score_overview: ScoreOverviewConfig
  score_detail: ScoreDetailConfig
  strengths_highlights: StrengthsHighlightsConfig
  development_plan: DevelopmentPlanConfig
  ai_text: AiTextConfig
  norm_comparison: NormComparisonConfig
  rater_comparison: RaterComparisonConfig
  gap_analysis: GapAnalysisConfig
  open_comments: OpenCommentsConfig
}

export interface BlockConfig<T extends BlockType = BlockType> {
  id: string
  type: T
  order: number
  config: BlockConfigMap[T]
  eyebrow?: string
  heading?: string
  blockDescription?: string
  condition?: BlockCondition
  printBreakBefore?: boolean
  printHide?: boolean
  screenHide?: boolean
  presentationMode?: PresentationMode
  columns?: 1 | 2 | 3
  chartType?: ChartType
  insetAccent?: string
}

// ---------------------------------------------------------------------------
// Resolved block data — written to report_snapshots.rendered_data
// ---------------------------------------------------------------------------

export interface ResolvedBlockData {
  blockId: string
  type: BlockType
  order: number
  eyebrow?: string
  heading?: string
  blockDescription?: string
  printBreakBefore?: boolean
  printHide?: boolean
  screenHide?: boolean
  // Block-specific resolved payload — typed by each block component
  data: Record<string, unknown>
  skipped?: boolean
  skipReason?: string
  presentationMode?: PresentationMode
  columns?: 1 | 2 | 3
  chartType?: ChartType
  insetAccent?: string
  resolvedBrandTheme?: ReportTheme
}

// ---------------------------------------------------------------------------
// Band resolution result
// ---------------------------------------------------------------------------

export type Band = 'low' | 'mid' | 'high'

export interface BandResult {
  band: Band
  bandLabel: string
  pompScore: number
  thresholdLow: number
  thresholdHigh: number
}
