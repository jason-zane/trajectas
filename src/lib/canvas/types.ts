/**
 * Types for the comparison canvas — the hero-chart + breakdown view that
 * serves every (people × time) setup on one page. See
 * docs/superpowers/specs/2026-06-13-growth-canvas-unified-trajectory-compare.md.
 */

/** Synthetic entity id for the per-session overall composite row. */
export const OVERALL_ID = '__overall'

export type CanvasLevel = 'dimension' | 'factor'

export type CanvasPerson = {
  /** Stable per-client person identity (falls back to the cp id for legacy rows). */
  personKey: string
  /** The campaign participant the person was selected through — used for URL round-trips. */
  entryCpId: string
  displayName: string
  email: string
  completedSessionCount: number
  firstCompletedAt: string | null
  lastCompletedAt: string | null
}

export type CanvasEntity = {
  id: string
  name: string
  level: CanvasLevel
  /** Parent dimension id for factors; null for dimensions. */
  parentId: string | null
}

export type CanvasPoint = {
  sessionId: string
  completedAt: string
  assessmentId: string
  assessmentName: string
  campaignId: string
  campaignTitle: string
  /** Attempt ordinal counted per (person, assessment) across linked campaign participations. */
  attemptNumber: number
  value: number
  /** Stored measurement-error band; null for rollups and composites. */
  ciLower: number | null
  ciUpper: number | null
}

export type CanvasSeries = {
  personKey: string
  /** Entity id, or OVERALL_ID for the composite. */
  entityId: string
  /** Sorted by completedAt ascending. Only sessions where the entity was measured. */
  points: CanvasPoint[]
}

export type CanvasResult = {
  people: CanvasPerson[]
  entities: CanvasEntity[]
  series: CanvasSeries[]
  /** Client the selection belongs to (first person's client). */
  clientId: string | null
}

export type CanvasOrder = 'standard' | 'change' | 'difference'

/** The on-screen state a growth report reproduces. */
export type CanvasViewState = {
  charted?: string
  order?: CanvasOrder
  showChange?: boolean
}

export const CANVAS_ORDERS: readonly CanvasOrder[] = ['standard', 'change', 'difference'] as const

export const CANVAS_ORDER_LABEL: Record<CanvasOrder, string> = {
  standard: 'Standard order',
  change: 'Largest change',
  difference: 'Biggest differences',
}
