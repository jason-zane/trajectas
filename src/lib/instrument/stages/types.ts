/**
 * Type definitions for the instrument builder engine stage graph.
 *
 * Defines stages, their status/severity, context for execution, and outcomes
 * of orchestrated runs. All types are pure—no DB access or side effects.
 *
 * @module
 */

import type { MeasureType } from '../types'

/**
 * Unique identifiers for each stage in the instrument builder pipeline.
 *
 * Stages are run in dependency order; later stages can depend on earlier ones.
 */
export type StageKey =
  | 'blueprint_draft'
  | 'blueprint_validate'
  | 'item_generation'
  | 'item_critique'
  | 'congruence_panel'
  | 'fairness_screen'
  | 'reliability_forecast'
  | 'coverage_audit'
  | 'publish_readiness'

export const STAGE_KEYS: StageKey[] = [
  'blueprint_draft',
  'blueprint_validate',
  'item_generation',
  'item_critique',
  'congruence_panel',
  'fairness_screen',
  'reliability_forecast',
  'coverage_audit',
  'publish_readiness',
]

/**
 * The execution state of a single stage.
 */
export type StageStatus =
  | 'pending'  // Not yet executed
  | 'running'  // Currently executing
  | 'success'  // Completed successfully
  | 'failure'  // Failed or thrown
  | 'paused'   // Execution paused by user or system

/**
 * How a stage failure affects the overall run.
 *
 * - blocking: If this stage fails, the entire run is stopped; all remaining
 *   stages are marked 'skipped'.
 * - advisory: If this stage fails, the run continues to the next stage.
 */
export type StageSeverity = 'blocking' | 'advisory'

/**
 * Runtime context passed to each stage's run function.
 *
 * Provides access to build metadata and a logger callback so stages can
 * report progress/diagnostics without directly writing to the database.
 * The caller's runner injects this context.
 */
export interface StageContext {
  /** UUID of the instrument build being orchestrated */
  buildId: string

  /** The measurement type of the build (trait, competency, etc.) */
  measureType: MeasureType

  /**
   * Log a detail message for this stage.
   * The runner collects these and includes them in the stage outcome.
   * Called 0+ times per stage.
   */
  log: (detail: string) => void
}

/**
 * A stage's input and output types, wrapped in a generic definition.
 *
 * Each stage takes input (typically the accumulated output of prior stages),
 * runs its logic, and returns output to be passed to the next stage.
 *
 * Generic parameters:
 *   In:  Input type (merged with previous stages' outputs)
 *   Out: Output type (added to the accumulator and passed to next stage)
 */
export interface StageDefinition<In = Record<string, unknown>, Out = Record<string, unknown>> {
  /** Unique identifier for this stage (must be a StageKey) */
  key: StageKey

  /**
   * Array of stage keys that must complete before this stage can run.
   * Stages are topologically sorted; if a stage is requested, all its
   * transitive dependencies are automatically included.
   */
  requires: StageKey[]

  /**
   * How this stage's failure affects the run:
   * - 'blocking': failure stops the run
   * - 'advisory': failure is recorded but run continues
   */
  severity: StageSeverity

  /**
   * Execute this stage.
   *
   * Called with a stage context and the accumulated input (merged outputs
   * from all prior stages). Should not throw; errors are caught and recorded.
   *
   * @param ctx  Runtime context with buildId, measureType, and log callback
   * @param input  Accumulated output from prior stages (merged into single object)
   * @returns The stage's output, merged into the accumulator
   */
  run: (ctx: StageContext, input: In) => Promise<Out>
}

/**
 * The recorded outcome of a single stage after it completes (or fails).
 *
 * One outcome is produced per stage that was requested or a dependency of a
 * requested stage.
 */
export interface StageOutcome {
  /** The stage key this outcome describes */
  key: StageKey

  /** Final status of the stage ('success', 'failure', 'skipped', etc.) */
  status: StageStatus

  /** Whether this stage was blocking or advisory */
  severity: StageSeverity

  /** Optional detail message from the stage or the runner */
  detail?: string

  /** If the stage failed, the error message or reason */
  error?: string

  /** Timestamp when execution started (ISO 8601) */
  startedAt: string

  /** Timestamp when execution completed (ISO 8601) */
  completedAt: string

  /** Duration in milliseconds */
  durationMs: number
}

/**
 * The overall result of running a stage graph.
 *
 * Contains the outcomes of all executed stages, plus high-level rollup
 * information (which stages completed, which failed, etc.).
 */
export interface GraphRunResult {
  /** Array of stage outcomes, one per stage that was run or skipped */
  outcomes: StageOutcome[]

  /** Set of stages that completed successfully */
  completed: StageKey[]

  /** Set of stages that were skipped due to prior stage failure */
  skipped: StageKey[]

  /** Set of stages that failed */
  failed: StageKey[]

  /**
   * True iff all requested and dependent stages completed successfully.
   * False if any blocking stage failed.
   */
  ok: boolean
}

/**
 * The registry of all available stages, used for topological sorting
 * and execution orchestration.
 */
export interface StageRegistry {
  /**
   * Look up a stage definition by key.
   * Returns the definition or undefined if not registered.
   */
  get: (key: StageKey) => StageDefinition | undefined

  /**
   * Get all registered stages in registration order.
   */
  all: () => StageDefinition[]

  /**
   * Resolve the execution order for a requested set of stages.
   * Returns an array of stage keys in topological order (dependencies before dependents).
   * Automatically includes transitive dependencies.
   *
   * Throws if a cycle is detected or an unknown stage is requested.
   */
  resolveOrder: (requested: StageKey[]) => StageKey[]
}
