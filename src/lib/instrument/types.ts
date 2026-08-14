/**
 * Type definitions for the instrument builder engine.
 *
 * Defines measurement types, lifecycle states, evidence classification,
 * and core data structures used across blueprint and evidence modules.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Enums & Constants
// ---------------------------------------------------------------------------

export type MeasureType = 'trait' | 'competency_behavioural' | 'capability' | 'sjt' | 'forced_choice' | 'preference' | 'climate' | 'validity_scale'

export const MEASURE_TYPES: MeasureType[] = [
  'trait',
  'competency_behavioural',
  'capability',
  'sjt',
  'forced_choice',
  'preference',
  'climate',
  'validity_scale'
]

export function isMeasureType(value: unknown): value is MeasureType {
  return typeof value === 'string' && MEASURE_TYPES.includes(value as MeasureType)
}

export type Intensity = 'low' | 'mid' | 'high'

export const INTENSITIES: Intensity[] = ['low', 'mid', 'high']

export type BuildStatus = 'draft' | 'blueprinting' | 'generating' | 'reviewing' | 'ready' | 'published' | 'failed'

export type ValidationState = 'provisional' | 'piloting' | 'calibrated' | 'published' | 'flagged' | 'retired'

export type EvidenceClass = 'a_priori' | 'synthetic' | 'empirical'

// ---------------------------------------------------------------------------
// Blueprint types
// ---------------------------------------------------------------------------

export interface BlueprintCell {
  /** Unique identifier for this cell */
  id: string
  /** Facet label (e.g., "Communication", "Strategic Thinking") */
  facetLabel: string
  /** Intensity level of this cell */
  intensity: Intensity
  /** Target number of items for this cell */
  targetItemCount: number
  /** Display order (used for allocation and UI sequencing) */
  displayOrder: number
}

export interface Blueprint {
  /** Unique identifier for this blueprint */
  id: string
  /** The construct this blueprint defines */
  constructId: string
  /** Type of measurement this blueprint describes */
  measureType: MeasureType
  /** Blueprint cells defining facet × intensity coverage */
  cells: BlueprintCell[]
  /** When the blueprint was created */
  createdAt: Date
  /** When the blueprint was last modified */
  updatedAt: Date
}

export interface CoverageReport {
  /** Per-cell coverage details */
  cells: Array<{
    /** Blueprint cell ID */
    cellId: string
    /** Facet label */
    facetLabel: string
    /** Intensity level */
    intensity: Intensity
    /** Target items for this cell */
    target: number
    /** Actual items assigned to this cell */
    actual: number
    /** Shortfall: max(0, target - actual) */
    deficit: number
    /** Overage: max(0, actual - target) */
    surplus: number
    /** Status: empty (0 items), under (< target), met (= target), over (> target) */
    status: 'empty' | 'under' | 'met' | 'over'
  }>
  /** Items not assigned to any blueprint cell */
  unassignedItemCount: number
  /** Sum of all target item counts */
  totalTarget: number
  /** Total items assigned (excludes unassigned) */
  totalActual: number
  /** Count of cells with 0 items */
  emptyCells: number
  /** Count of cells with 0 < actual < target */
  underfilledCells: number
  /** True iff all cells are met or over (emptyCells === 0 && underfilledCells === 0) */
  isComplete: boolean
}

// ---------------------------------------------------------------------------
// Evidence types
// ---------------------------------------------------------------------------

export interface EvidenceRecord {
  /** Unique identifier for this record */
  id: string
  /**
   * What entity this evidence targets. Must match the `target_type` CHECK
   * constraint on `instrument_evidence` in the database.
   */
  targetType: 'item' | 'construct' | 'instrument'
  /** ID of the target entity */
  targetId: string
  /** The claim being evidenced (e.g., "alpha", "assignment_accuracy", "item_total_r") */
  claim: string
  /** The claimed value itself — the number this record exists to carry. */
  value: number
  /** Uncertainty interval around `value`, when the method produces one. */
  interval?: [number, number]
  /** Provenance: a priori (forecasted), synthetic (simulated), or empirical (observed) */
  evidenceClass: EvidenceClass
  /** How the value was produced, e.g. 'forecast_v1', 'congruence_panel_v1', 'ctt_alpha'. */
  method: string
  /** Respondents behind the value. Null/undefined for a-priori evidence. */
  sampleSize?: number
  /** Optional extras: mean, sd, data source, etc. */
  detail?: {
    n?: number
    mean?: number
    sd?: number
    source?: string
  }
  /** When this evidence was produced */
  producedAt: Date
  /** Timestamp when this record was superseded by newer evidence (if any) */
  supersededAt?: Date | null
}
