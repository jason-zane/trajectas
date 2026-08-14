/**
 * Stage graph runner with sequential execution and error handling.
 *
 * Executes stages in resolved order, accumulates outputs, and handles
 * blocking vs. advisory failures. Pure module (no DB I/O; callbacks handle persistence).
 *
 * @module
 */

import type {
  GraphRunResult,
  StageContext,
  StageKey,
  StageOutcome,
  StageRegistry,
  StageSeverity,
  StageStatus,
} from './types'

/**
 * Handlers called during execution.
 *
 * onOutcome is called once per stage after it completes (or fails).
 * now is used for timestamps; defaults to Date.now() for real time,
 * injectable for testing (deterministic clocks).
 */
export interface RunGraphHandlers {
  /**
   * Called after each stage completes or fails.
   * Awaited, so the caller can persist the outcome to the database.
   *
   * @param outcome The stage outcome to persist
   */
  onOutcome: (outcome: StageOutcome) => Promise<void>

  /**
   * Optional clock function (for testing determinism).
   * Defaults to Date.now().
   * Should return milliseconds since epoch.
   */
  now?: () => number
}

/**
 * Run a stage graph sequentially.
 *
 * Executes the requested stages (and their transitive dependencies) in
 * topologically sorted order. Output from each stage is merged into an
 * accumulator and passed to the next stage as input.
 *
 * Error semantics:
 * - If a 'blocking' stage fails, the run stops and all remaining stages are skipped.
 * - If an 'advisory' stage fails, the run continues.
 * - Stage errors are caught and never crash the run.
 *
 * @param registry The stage registry (with resolved order)
 * @param requested The stage keys the caller wants to execute
 * @param initialInput The input to pass to the first stage
 * @param handlers Callbacks for persistence and clock injection
 * @returns A GraphRunResult with outcomes, completed/skipped/failed sets, and ok flag
 */
export async function runGraph(
  registry: StageRegistry,
  requested: StageKey[],
  initialInput: Record<string, unknown>,
  handlers: RunGraphHandlers,
): Promise<GraphRunResult> {
  const now = handlers.now ?? (() => Date.now())
  const order = registry.resolveOrder(requested)
  const outcomes: StageOutcome[] = []
  const completed: StageKey[] = []
  const skipped: StageKey[] = []
  const failed: StageKey[] = []

  // Accumulated output: each stage merges its output into this object
  let accumulator = { ...initialInput }

  // Track log messages for the current stage
  let currentLogs: string[] = []

  for (const key of order) {
    const def = registry.get(key)
    if (!def) {
      // Should not happen if registry is valid, but be defensive
      continue
    }

    // Check if a blocking stage already failed
    if (failed.length > 0) {
      const blockingFailed = failed.some((failedKey) => {
        const failedDef = registry.get(failedKey)
        return failedDef?.severity === 'blocking'
      })

      if (blockingFailed) {
        // Skip remaining stages
        const outcome = createSkippedOutcome(key, def.severity, now)
        outcomes.push(outcome)
        skipped.push(key)
        await handlers.onOutcome(outcome)
        continue
      }
    }

    // Reset logs for this stage
    currentLogs = []

    // Create stage context
    const ctx: StageContext = {
      buildId: 'unknown',  // Will be set by caller before stages run
      measureType: 'trait',  // Will be set by caller
      log: (detail: string) => {
        currentLogs.push(detail)
      },
    }

    // Track timing
    const startedAtMs = now()
    const startedAt = new Date(startedAtMs).toISOString()

    let status: StageStatus = 'success'
    let error: string | undefined
    let detail: string | undefined

    try {
      // Run the stage with accumulated input
      const output = await def.run(ctx, accumulator)

      // Merge output into accumulator
      if (output && typeof output === 'object') {
        accumulator = { ...accumulator, ...output }
      }

      // Collect logs as detail
      if (currentLogs.length > 0) {
        detail = currentLogs.join('\n')
      }
    } catch (err) {
      status = 'failure'
      error =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Unknown error'

      // Capture any logs before the error
      if (currentLogs.length > 0) {
        detail = currentLogs.join('\n')
      }

      failed.push(key)
    }

    if (status === 'success') {
      completed.push(key)
    }

    // Create outcome
    const completedAtMs = now()
    const completedAt = new Date(completedAtMs).toISOString()
    const durationMs = completedAtMs - startedAtMs

    const outcome: StageOutcome = {
      key,
      status,
      severity: def.severity,
      detail,
      error,
      startedAt,
      completedAt,
      durationMs,
    }

    outcomes.push(outcome)
    await handlers.onOutcome(outcome)
  }

  // Determine overall success
  const ok = failed.length === 0

  return {
    outcomes,
    completed,
    skipped,
    failed,
    ok,
  }
}

/**
 * Create a skipped outcome (when a stage is not run due to prior failure).
 */
function createSkippedOutcome(
  key: StageKey,
  severity: StageSeverity,
  now: () => number,
): StageOutcome {
  const startedAtMs = now()
  const completedAtMs = now()

  return {
    key,
    status: 'paused',  // Use 'paused' for skipped stages
    severity,
    detail: 'Skipped due to prior blocking stage failure',
    startedAt: new Date(startedAtMs).toISOString(),
    completedAt: new Date(completedAtMs).toISOString(),
    durationMs: 0,
  }
}
