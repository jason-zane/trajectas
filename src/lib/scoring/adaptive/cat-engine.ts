/**
 * Computerized Adaptive Testing (CAT) engine.
 *
 * CAT dynamically selects items based on the examinee's estimated ability,
 * converging on a precise theta estimate with fewer items than a fixed-form
 * test.  The algorithm follows the standard CAT loop:
 *
 * ```
 * 1. Initialise theta and SE
 * 2. Select the most informative unadministered item
 * 3. Administer the item and record the response
 * 4. Re-estimate theta via MLE (or EAP for edge cases)
 * 5. Check termination criteria (SE threshold, min/max items)
 * 6. If not terminated, go to step 2
 * ```
 *
 * Item selection uses **Maximum Fisher Information (MFI)**: at each step
 * the item whose information function is highest at the current theta
 * estimate is chosen.  This is the most widely used selection criterion
 * in operational CAT programs.
 *
 * @module
 */

import type {
  IRTParameters,
  IRTResponse,
  CATConfig,
  CATState,
} from '@/types/scoring'
import { itemInformation } from '../irt/models'
import { estimateMLE, estimateEAP } from '../irt/estimation'

/**
 * Stateless CAT engine that manages item selection, ability estimation,
 * and termination logic.
 *
 * The engine is intentionally **stateless** — all mutable session data
 * lives in the {@link CATState} object, making it easy to persist
 * mid-session state in a database and resume later.
 *
 * @example
 * ```ts
 * const engine = new CATEngine(config, itemPool)
 * let state = engine.initialize()
 *
 * while (!state.isComplete) {
 *   const itemId = state.nextItemId!
 *   const response = await presentItemToCandidate(itemId)
 *   state = engine.processResponse(state, itemId, response)
 * }
 *
 * console.log(`Final theta: ${state.currentTheta}, SE: ${state.standardError}`)
 * ```
 */
export class CATEngine {
  private readonly config: CATConfig
  private readonly itemPool: Map<string, IRTParameters>

  /**
   * @param config   - CAT session configuration (min/max items, SE threshold,
   *                   theta search boundaries).
   * @param itemPool - Available item bank, keyed by item ID.
   */
  constructor(config: CATConfig, itemPool: Map<string, IRTParameters>) {
    if (itemPool.size === 0) {
      throw new Error('Item pool must contain at least one item.')
    }
    if (config.minItems > config.maxItems) {
      throw new Error(
        `minItems (${config.minItems}) must not exceed maxItems (${config.maxItems}).`,
      )
    }
    if (config.maxItems > itemPool.size) {
      throw new Error(
        `maxItems (${config.maxItems}) exceeds item pool size (${itemPool.size}).`,
      )
    }

    this.config = config
    this.itemPool = itemPool
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Create the initial CAT session state.
   *
   * Theta starts at 0 (the centre of the ability scale) with a
   * large SE (1.0) indicating maximum uncertainty.  The first item
   * is pre-selected so the caller can immediately administer it.
   *
   * @returns A fresh {@link CATState} ready for the first item.
   */
  initialize(): CATState {
    const state: CATState = {
      currentTheta: 0,
      standardError: 1.0,
      itemsAdministered: [],
      responses: [],
      isComplete: false,
    }

    // Pre-select the first item.
    state.nextItemId = this.selectNextItem(state)

    return state
  }

  /**
   * Select the next item to administer using Maximum Fisher Information.
   *
   * Among all items not yet administered, the one whose information
   * function `I_i(theta)` is highest at the current theta is chosen.
   * This maximises the expected reduction in SE from each new item.
   *
   * @param state - Current session state.
   * @returns The item ID of the most informative available item.
   * @throws If no unadministered items remain.
   */
  selectNextItem(state: CATState): string {
    const administered = new Set(state.itemsAdministered)
    let bestItemId: string | undefined
    let bestInfo = -Infinity

    for (const [id, params] of this.itemPool) {
      if (administered.has(id)) continue

      const info = itemInformation(state.currentTheta, params)
      if (info > bestInfo) {
        bestInfo = info
        bestItemId = id
      }
    }

    if (!bestItemId) {
      throw new Error('No unadministered items remain in the pool.')
    }

    return bestItemId
  }

  /**
   * Update the ability estimate after a new response.
   *
   * This method:
   * 1. Records the response in the state's response array.
   * 2. Re-estimates theta via MLE (falling back to EAP when MLE
   *    is undefined, e.g. for all-correct or all-incorrect patterns).
   * 3. Clamps theta to the configured `[minTheta, maxTheta]` bounds.
   * 4. Recalculates the standard error.
   *
   * The returned state is a **new object** — the input state is not mutated.
   *
   * @param state    - Current session state.
   * @param itemId   - The item that was administered.
   * @param response - 1 for correct, 0 for incorrect.
   * @returns Updated session state with revised theta and SE.
   */
  updateEstimate(state: CATState, itemId: string, response: number): CATState {
    if (!this.itemPool.has(itemId)) {
      throw new Error(`Item "${itemId}" is not in the item pool.`)
    }

    // Build the new response record.
    const newResponse: IRTResponse = {
      itemId,
      responseValue: response,
    }

    const newResponses = [...state.responses, newResponse]
    const newAdministered = [...state.itemsAdministered, itemId]

    // Attempt MLE first; it handles the all-correct / all-incorrect
    // fallback internally by delegating to EAP.
    let estimate = estimateMLE(newResponses, this.itemPool, {
      initialTheta: state.currentTheta,
    })

    // If we only have a single response, MLE may not converge well.
    // Use EAP as a more robust fallback for very short sequences.
    if (newResponses.length <= 2) {
      estimate = estimateEAP(newResponses, this.itemPool)
    }

    // Clamp theta to the configured search bounds.
    let theta = estimate.theta
    theta = Math.max(this.config.minTheta, Math.min(this.config.maxTheta, theta))

    return {
      currentTheta: theta,
      standardError: estimate.standardError,
      itemsAdministered: newAdministered,
      responses: newResponses,
      isComplete: state.isComplete,
      terminationReason: state.terminationReason,
      nextItemId: state.nextItemId,
    }
  }

  /**
   * Evaluate whether the CAT session should terminate.
   *
   * Termination occurs when **any** of the following conditions are met:
   *
   * 1. **Maximum items reached** — hard stop to cap test length.
   * 2. **SE threshold met** — the standard error has dropped below
   *    the configured threshold *and* at least `minItems` have been
   *    administered.
   * 3. **Item pool exhausted** — no more unadministered items remain.
   *
   * @param state - Current session state.
   * @returns An object indicating whether to terminate and why.
   */
  shouldTerminate(state: CATState): { terminate: boolean; reason?: string } {
    const itemCount = state.itemsAdministered.length

    // Hard ceiling.
    if (itemCount >= this.config.maxItems) {
      return { terminate: true, reason: 'Maximum number of items reached.' }
    }

    // Pool exhausted.
    const remaining = this.itemPool.size - itemCount
    if (remaining <= 0) {
      return { terminate: true, reason: 'Item pool exhausted.' }
    }

    // SE threshold (only after minimum items).
    if (
      itemCount >= this.config.minItems &&
      state.standardError <= this.config.seThreshold
    ) {
      return {
        terminate: true,
        reason:
          `Standard error (${state.standardError.toFixed(4)}) ` +
          `reached threshold (${this.config.seThreshold}).`,
      }
    }

    return { terminate: false }
  }

  /**
   * Full response-processing pipeline: update estimate, check termination,
   * and select the next item if the session continues.
   *
   * This is the primary method callers should use inside the CAT loop.
   *
   * @param state    - Current session state.
   * @param itemId   - The item that was administered.
   * @param response - 1 for correct, 0 for incorrect.
   * @returns Updated session state.  If `isComplete` is true, `nextItemId`
   *          will be `undefined`.
   */
  processResponse(state: CATState, itemId: string, response: number): CATState {
    // 1. Update the estimate.
    let newState = this.updateEstimate(state, itemId, response)

    // 2. Check termination.
    const { terminate, reason } = this.shouldTerminate(newState)

    if (terminate) {
      return {
        ...newState,
        isComplete: true,
        terminationReason: reason,
        nextItemId: undefined,
      }
    }

    // 3. Select next item.
    const nextItemId = this.selectNextItem(newState)

    return {
      ...newState,
      nextItemId,
    }
  }
}
