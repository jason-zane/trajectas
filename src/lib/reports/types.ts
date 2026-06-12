// =============================================================================
// src/lib/reports/types.ts — Block engine type system
// =============================================================================

import type { PresentationMode, ChartType, ReportTheme, ReportDepth } from './presentation'

// ---------------------------------------------------------------------------
// Block type registry key
// ---------------------------------------------------------------------------

export type BlockType =
  // Meta
  | 'cover_page'
  | 'custom_text'
  | 'section_divider'
  | 'contents'
  | 'closing_page'
  // Score (self-report + 360)
  | 'score_overview'
  | 'score_detail'
  | 'score_interpretation'
  | 'score_interpretation_v2'
  | 'dimension_chapter'
  | 'strengths_highlights'
  | 'development_plan'
  | 'norm_comparison'   // registered but deferred — runner skips if included
  // AI
  | 'ai_text'
  // 360-only
  | 'rater_comparison'
  | 'gap_analysis'
  | 'open_comments'
  // Custom (code-registered) — bypasses block dispatch in renderer
  | 'custom'

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
  showAnchors?: boolean
  entityIds?: string[]  // null/empty = all scored entities
  /** How much information each row carries (bar chart type only). Default 'glance'. */
  depth?: ReportDepth
}

export interface DimensionChapterConfig {
  /** How much information each factor entry carries. Default 'standard'. */
  depth?: ReportDepth
  /** Limit chapters to specific dimensions; empty = all scored dimensions. */
  dimensionIds?: string[]
  /** Render the dimension's description/definition under the chapter hero. Default true. */
  showDimensionSummary?: boolean
  /**
   * Page-flow policy for print:
   *   auto       → short chapters keep together (pack onto shared pages); long ones may split
   *   new_page   → every chapter starts on a fresh page
   *   continuous → no flow constraints beyond atomic factor entries
   */
  chapterFlow?: 'auto' | 'new_page' | 'continuous'
}

export interface ContentsConfig {
  /** Show the "how to read" band legend panel. Default true. */
  showBandLegend?: boolean
}

export interface ClosingPageConfig {
  /** Markdown/HTML methodology paragraph. Empty = sensible default copy. */
  methodologyText?: string
  showBandLegend?: boolean
  /** Markdown/HTML confidentiality paragraph. Empty = sensible default copy. */
  confidentialityText?: string
}

export interface ScoreInterpretationConfig {
  displayLevel: 'dimension' | 'factor' | 'construct'
  groupByDimension?: boolean
  showScore?: boolean
  showBandLabel?: boolean
  showAnchors?: boolean
  // Group-level display toggles — show the dimension/factor's own score,
  // band, and anchors above each group. All default false.
  showGroupScore?: boolean
  showGroupBand?: boolean
  showGroupAnchors?: boolean
}

export interface ScoreInterpretationV2Config {
  displayLevel: 'dimension' | 'factor' | 'construct'
  groupByDimension?: boolean

  // Factor-level display toggles (default true)
  showScore?: boolean
  showBandLabel?: boolean
  showAnchors?: boolean

  // Parent/group-level display toggles (default false)
  showGroupScore?: boolean
  showGroupBand?: boolean
  showGroupAnchors?: boolean
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

/**
 * Custom-report block — not user-selectable. Synthesised by the runner when
 * a template has custom_report_slug set; carries the slug + opaque payload
 * that the matching component will consume.
 */
export interface CustomBlockConfig {
  slug: string
}

// ---------------------------------------------------------------------------
// BlockConfig — one entry in report_templates.blocks
// ---------------------------------------------------------------------------

export type BlockConfigMap = {
  cover_page: CoverPageConfig
  custom_text: CustomTextConfig
  section_divider: SectionDividerConfig
  contents: ContentsConfig
  closing_page: ClosingPageConfig
  dimension_chapter: DimensionChapterConfig
  score_overview: ScoreOverviewConfig
  score_detail: ScoreDetailConfig
  score_interpretation: ScoreInterpretationConfig
  score_interpretation_v2: ScoreInterpretationV2Config
  strengths_highlights: StrengthsHighlightsConfig
  development_plan: DevelopmentPlanConfig
  ai_text: AiTextConfig
  norm_comparison: NormComparisonConfig
  rater_comparison: RaterComparisonConfig
  gap_analysis: GapAnalysisConfig
  open_comments: OpenCommentsConfig
  custom: CustomBlockConfig
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
  bandKey: string              // e.g. 'developing'
  bandLabel: string            // e.g. 'Developing'
  bandIndex: number            // 0-based position in scheme.bands
  bandCount: number            // total bands in scheme (for palette colour derivation)
  indicatorTier: Band          // which library indicator tier to display (low/mid/high)
  pompScore: number
}
