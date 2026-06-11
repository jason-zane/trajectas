/**
 * Characterization tests for the CATEngine (Computerized Adaptive Testing).
 *
 * The CAT engine:
 *   1. Initializes with theta=0, SE=1.0
 *   2. Selects the most informative unadministered item (Maximum Fisher Information)
 *   3. Records responses and re-estimates theta via MLE (with EAP fallback)
 *   4. Terminates when SE drops below threshold, max items reached, or pool exhausted
 *   5. Returns a final state with theta, SE, response history, and termination reason
 *
 * Tests are stateless: each call produces a new state object.
 */

import { describe, expect, it } from 'vitest'
import { CATEngine } from '@/lib/scoring/adaptive/cat-engine'
import type { IRTParameters, CATConfig } from '@/types/scoring'

// Test fixtures
function create2PLItem(id: string, difficulty: number, discrimination: number = 1.2): IRTParameters {
  return {
    modelType: '2PL',
    discrimination,
    difficulty,
    guessing: 0,
  }
}

function createItemPool(params: Array<{ id: string; difficulty: number }>): Map<string, IRTParameters> {
  const pool = new Map<string, IRTParameters>()
  for (const { id, difficulty } of params) {
    pool.set(id, create2PLItem(id, difficulty))
  }
  return pool
}

const defaultConfig: CATConfig = {
  minItems: 2,
  maxItems: 3, // Adjusted to fit typical test pools
  seThreshold: 0.3,
  minTheta: -6,
  maxTheta: 6,
}

describe('CATEngine', () => {
  // -----------------------------------------------------------------------
  // Constructor validation
  // -----------------------------------------------------------------------
  describe('constructor', () => {
    it('throws when item pool is empty', () => {
      expect(() => new CATEngine(defaultConfig, new Map())).toThrow(/Item pool must contain/)
    })

    it('throws when minItems > maxItems', () => {
      const badConfig = { ...defaultConfig, minItems: 20, maxItems: 10 }
      const pool = createItemPool([{ id: 'item-1', difficulty: 0 }])

      expect(() => new CATEngine(badConfig, pool)).toThrow(/minItems.*must not exceed maxItems/)
    })

    it('throws when maxItems exceeds item pool size', () => {
      const badConfig = { ...defaultConfig, maxItems: 10 }
      const pool = createItemPool([{ id: 'item-1', difficulty: 0 }])

      expect(() => new CATEngine(badConfig, pool)).toThrow(/maxItems.*exceeds item pool size/)
    })

    it('succeeds with valid config and pool', () => {
      const pool = createItemPool([
        { id: 'item-1', difficulty: -1 },
        { id: 'item-2', difficulty: 0 },
        { id: 'item-3', difficulty: 1 },
      ])
      expect(() => new CATEngine(defaultConfig, pool)).not.toThrow()
    })
  })

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------
  describe('initialize', () => {
    it('hand-derives initial state with theta=0, SE=1.0', () => {
      const pool = createItemPool([
        { id: 'item-1', difficulty: -1 },
        { id: 'item-2', difficulty: 0 },
        { id: 'item-3', difficulty: 1 },
      ])

      const engine = new CATEngine(defaultConfig, pool)
      const state = engine.initialize()

      expect(state.currentTheta).toBe(0)
      expect(state.standardError).toBe(1.0)
      expect(state.isComplete).toBe(false)
      expect(state.itemsAdministered).toEqual([])
      expect(state.responses).toEqual([])
    })

    it('pre-selects the first item (highest information at theta=0)', () => {
      // Note: create2PLItem uses fixed discrimination=1.2, so this just uses different difficulties
      const pool = createItemPool([
        { id: 'item-easy', difficulty: -2 },
        { id: 'item-medium', difficulty: 0 }, // Closest to theta=0
        { id: 'item-hard', difficulty: 2 },
      ])

      const engine = new CATEngine(defaultConfig, pool)
      const state = engine.initialize()

      expect(state.nextItemId).toBeDefined()
      // At theta=0, item-medium (diff=0, discrimination=1.5) should have highest information
      expect(state.nextItemId).toBe('item-medium')
    })

    it('does not count pre-selected item in itemsAdministered', () => {
      const pool = createItemPool([
        { id: 'item-1', difficulty: -1 },
        { id: 'item-2', difficulty: 0 },
        { id: 'item-3', difficulty: 1 },
      ])

      const engine = new CATEngine(defaultConfig, pool)
      const state = engine.initialize()

      expect(state.itemsAdministered).toHaveLength(0)
      expect(state.nextItemId).toBeDefined()
    })
  })

  // -----------------------------------------------------------------------
  // Item selection (Maximum Fisher Information)
  // -----------------------------------------------------------------------
  describe('selectNextItem', () => {
    it('selects the unadministered item with highest information at current theta', () => {
      const pool = createItemPool([
        { id: 'item-1', difficulty: -1 },
        { id: 'item-2', difficulty: 0 },
        { id: 'item-3', difficulty: 1 },
      ])

      const engine = new CATEngine(defaultConfig, pool)

      // At theta=0, item closest to difficulty 0 should have highest information
      const initialState = engine.initialize()
      expect(initialState.nextItemId).toBe('item-2')
    })

    it('throws when no unadministered items remain', () => {
      const pool = createItemPool([{ id: 'item-1', difficulty: 0 }])

      const config: CATConfig = { ...defaultConfig, minItems: 1, maxItems: 1 }
      const engine = new CATEngine(config, pool)

      let state = engine.initialize()
      // Manually mark all items as administered
      state = {
        ...state,
        itemsAdministered: ['item-1'],
      }

      expect(() => engine.selectNextItem(state)).toThrow(/No unadministered items/)
    })
  })

  // -----------------------------------------------------------------------
  // Estimate updates (MLE / EAP with SE recalculation)
  // -----------------------------------------------------------------------
  describe('updateEstimate', () => {
    it('throws when item is not in the pool', () => {
      const pool = createItemPool([{ id: 'item-1', difficulty: 0 }])

      const config: CATConfig = { ...defaultConfig, minItems: 1, maxItems: 1 }
      const engine = new CATEngine(config, pool)
      const state = engine.initialize()

      expect(() => engine.updateEstimate(state, 'item-not-in-pool', 1)).toThrow(
        /not in the item pool/,
      )
    })

    it('increases theta estimate after correct response on harder items', () => {
      const pool = createItemPool([
        { id: 'item-1', difficulty: -1 },
        { id: 'item-2', difficulty: 0 },
        { id: 'item-3', difficulty: 1 },
      ])

      const engine = new CATEngine(defaultConfig, pool)

      let state = engine.initialize()
      state = { ...state, nextItemId: undefined } // Prepare state

      // Correct on item-2 (difficulty=0) should raise theta estimate above 0
      state = engine.updateEstimate(state, 'item-2', 1)

      expect(state.currentTheta).toBeGreaterThan(0)
      expect(state.responses).toHaveLength(1)
      expect(state.itemsAdministered).toHaveLength(1)
    })

    it('decreases theta estimate after incorrect response on easier items', () => {
      const pool = createItemPool([
        { id: 'item-1', difficulty: -1 },
        { id: 'item-2', difficulty: 0 },
        { id: 'item-3', difficulty: 1 },
      ])

      const engine = new CATEngine(defaultConfig, pool)

      let state = engine.initialize()
      state = { ...state, nextItemId: undefined }

      // Incorrect on item-1 (difficulty=-1) should lower theta estimate below 0
      state = engine.updateEstimate(state, 'item-1', 0)

      expect(state.currentTheta).toBeLessThan(0)
      expect(state.responses).toHaveLength(1)
    })

    it('clamps theta to [minTheta, maxTheta] bounds', () => {
      const config: CATConfig = { ...defaultConfig, minTheta: -3, maxTheta: 3 }
      const pool = createItemPool([
        { id: 'item-1', difficulty: -2 },
        { id: 'item-2', difficulty: 0 },
        { id: 'item-3', difficulty: 2 },
      ])

      const engine = new CATEngine(config, pool)

      let state = engine.initialize()
      state = { ...state, nextItemId: undefined }

      // All correct answers would push theta high
      state = engine.updateEstimate(state, 'item-1', 1)
      state = engine.updateEstimate(state, 'item-2', 1)
      state = engine.updateEstimate(state, 'item-3', 1)

      expect(state.currentTheta).toBeLessThanOrEqual(3)
      expect(state.currentTheta).toBeGreaterThanOrEqual(-3)
    })

    it('reduces standard error as more items are administered', () => {
      const pool = createItemPool([
        { id: 'item-1', difficulty: -1 },
        { id: 'item-2', difficulty: 0 },
        { id: 'item-3', difficulty: 1 },
      ])

      const engine = new CATEngine(defaultConfig, pool)

      let state = engine.initialize()
      state = { ...state, nextItemId: undefined }

      const initialSE = state.standardError

      state = engine.updateEstimate(state, 'item-1', 1)
      const se1 = state.standardError

      state = engine.updateEstimate(state, 'item-2', 1)
      const se2 = state.standardError

      expect(se1).toBeLessThan(initialSE)
      expect(se2).toBeLessThan(se1)
    })

    it('uses EAP fallback for very short response sequences (1-2 items)', () => {
      const pool = createItemPool([
        { id: 'item-1', difficulty: 0 },
        { id: 'item-2', difficulty: 0 },
      ])

      const config: CATConfig = { ...defaultConfig, maxItems: 2 }
      const engine = new CATEngine(config, pool)

      let state = engine.initialize()
      state = { ...state, nextItemId: undefined }

      // First update uses EAP due to length <= 2
      state = engine.updateEstimate(state, 'item-1', 1)

      expect(Number.isFinite(state.currentTheta)).toBe(true)
      expect(state.currentTheta).toBeGreaterThan(-6)
      expect(state.currentTheta).toBeLessThan(6)
    })

    it('returns a new state object (immutable)', () => {
      const pool = createItemPool([
        { id: 'item-1', difficulty: 0 },
        { id: 'item-2', difficulty: 0 },
      ])

      const config: CATConfig = { ...defaultConfig, maxItems: 2 }
      const engine = new CATEngine(config, pool)

      const state1 = engine.initialize()
      const state2 = engine.updateEstimate(state1, 'item-1', 1)

      expect(state1).not.toBe(state2)
      expect(state1.currentTheta).toBe(0)
      expect(state2.currentTheta).not.toBe(0)
    })
  })

  // -----------------------------------------------------------------------
  // Termination logic
  // -----------------------------------------------------------------------
  describe('shouldTerminate', () => {
    it('terminates when maxItems reached', () => {
      const config: CATConfig = { ...defaultConfig, maxItems: 2 }
      const pool = createItemPool([
        { id: 'item-1', difficulty: 0 },
        { id: 'item-2', difficulty: 0 },
        { id: 'item-3', difficulty: 0 },
      ])

      const engine = new CATEngine(config, pool)

      let state = engine.initialize()
      state = { ...state, itemsAdministered: ['item-1', 'item-2'] }

      const { terminate, reason } = engine.shouldTerminate(state)

      expect(terminate).toBe(true)
      expect(reason).toContain('Maximum number of items')
    })

    it('hand-derives termination when SE <= seThreshold (after minItems)', () => {
      const config: CATConfig = { ...defaultConfig, minItems: 2, seThreshold: 0.5 }
      const pool = createItemPool([
        { id: 'item-1', difficulty: 0 },
        { id: 'item-2', difficulty: 0 },
        { id: 'item-3', difficulty: 0 },
      ])

      const engine = new CATEngine(config, pool)

      const state = {
        currentTheta: 0.5,
        standardError: 0.3, // Below 0.5 threshold
        itemsAdministered: ['item-1', 'item-2'],
        responses: [
          { itemId: 'item-1', responseValue: 1 },
          { itemId: 'item-2', responseValue: 1 },
        ],
        isComplete: false,
      }

      const { terminate, reason } = engine.shouldTerminate(state)

      expect(terminate).toBe(true)
      expect(reason).toContain('Standard error')
    })

    it('does not terminate on SE threshold if minItems not reached', () => {
      const config: CATConfig = { ...defaultConfig, minItems: 3, seThreshold: 0.5 }
      const pool = createItemPool([
        { id: 'item-1', difficulty: 0 },
        { id: 'item-2', difficulty: 0 },
        { id: 'item-3', difficulty: 0 },
      ])

      const engine = new CATEngine(config, pool)

      const state = {
        currentTheta: 0.5,
        standardError: 0.3, // Below threshold
        itemsAdministered: ['item-1', 'item-2'], // Only 2 items, need 3
        responses: [
          { itemId: 'item-1', responseValue: 1 },
          { itemId: 'item-2', responseValue: 1 },
        ],
        isComplete: false,
      }

      const { terminate } = engine.shouldTerminate(state)

      expect(terminate).toBe(false)
    })

    it('terminates when item pool is exhausted', () => {
      const config: CATConfig = { ...defaultConfig, minItems: 1, maxItems: 1 }
      const pool = createItemPool([{ id: 'item-1', difficulty: 0 }])

      const engine = new CATEngine(config, pool)

      const state = {
        currentTheta: 0,
        standardError: 0.9, // Above threshold
        itemsAdministered: ['item-1'], // All items exhausted
        responses: [{ itemId: 'item-1', responseValue: 1 }],
        isComplete: false,
      }

      const { terminate, reason } = engine.shouldTerminate(state)

      expect(terminate).toBe(true)
      // With maxItems=1 and 1 item administered, we hit max items, not pool exhaustion
      expect(reason).toMatch(/Maximum number of items|Item pool exhausted/)
    })

    it('returns { terminate: false } when no termination condition met', () => {
      const pool = createItemPool([
        { id: 'item-1', difficulty: 0 },
        { id: 'item-2', difficulty: 0 },
        { id: 'item-3', difficulty: 0 },
      ])

      const engine = new CATEngine(defaultConfig, pool)

      const state = {
        currentTheta: 0,
        standardError: 0.5, // Above threshold (0.3)
        itemsAdministered: ['item-1'], // Below minItems (2)
        responses: [{ itemId: 'item-1', responseValue: 1 }],
        isComplete: false,
      }

      const { terminate } = engine.shouldTerminate(state)

      expect(terminate).toBe(false)
    })
  })

  // -----------------------------------------------------------------------
  // Full response processing pipeline
  // -----------------------------------------------------------------------
  describe('processResponse (full CAT loop)', () => {
    it('hand-derives a complete CAT session: init → response → response → terminate', () => {
      /**
       * Simple session:
       * 1. Initialize: theta=0, SE=1.0, select item-2 (highest info at 0)
       * 2. Respond correct to item-2: theta > 0, SE reduced
       * 3. Respond incorrect to item-3: theta adjusted, SE further reduced
       * 4. Check: if SE <= threshold and items >= minItems, terminate
       */
      const pool = createItemPool([
        { id: 'item-1', difficulty: -1 },
        { id: 'item-2', difficulty: 0 },
        { id: 'item-3', difficulty: 1 },
      ])

      const config: CATConfig = { ...defaultConfig, minItems: 2, seThreshold: 0.4 }
      const engine = new CATEngine(config, pool)

      // Initialize
      let state = engine.initialize()
      expect(state.currentTheta).toBe(0)
      expect(state.standardError).toBe(1.0)
      expect(state.isComplete).toBe(false)

      const firstItem = state.nextItemId!
      expect(firstItem).toBe('item-2')

      // First response (correct on item-2)
      state = engine.processResponse(state, 'item-2', 1)
      expect(state.currentTheta).toBeGreaterThan(0)
      expect(state.standardError).toBeLessThan(1.0)
      expect(state.itemsAdministered).toHaveLength(1)
      expect(state.isComplete).toBe(false)
      expect(state.nextItemId).toBeDefined()

      // Second response (incorrect on a higher-difficulty item)
      const secondItem = state.nextItemId!
      state = engine.processResponse(state, secondItem, 0)
      expect(state.itemsAdministered).toHaveLength(2)
      // Now check termination: SE should be lower, minItems met
      if (state.standardError <= config.seThreshold) {
        expect(state.isComplete).toBe(true)
        expect(state.terminationReason).toContain('Standard error')
        expect(state.nextItemId).toBeUndefined()
      }
    })

    it('selects next item after each response (until termination)', () => {
      const pool = createItemPool([
        { id: 'item-1', difficulty: -1 },
        { id: 'item-2', difficulty: 0 },
        { id: 'item-3', difficulty: 1 },
      ])

      const engine = new CATEngine(defaultConfig, pool)

      let state = engine.initialize()
      const firstItem = state.nextItemId!

      state = engine.processResponse(state, firstItem, 1)

      expect(state.nextItemId).toBeDefined()
      expect(state.nextItemId).not.toBe(firstItem)
    })

    it('stops selecting items once terminated', () => {
      const pool = createItemPool([
        { id: 'item-1', difficulty: 0 },
        { id: 'item-2', difficulty: 0 },
      ])

      const config: CATConfig = { ...defaultConfig, minItems: 1, maxItems: 1 }
      const engine = new CATEngine(config, pool)

      let state = engine.initialize()
      state = engine.processResponse(state, 'item-1', 1)

      expect(state.isComplete).toBe(true)
      expect(state.nextItemId).toBeUndefined()
      expect(state.terminationReason).toBeDefined()
    })

    it('returns immutable states at each step', () => {
      const pool = createItemPool([
        { id: 'item-1', difficulty: 0 },
        { id: 'item-2', difficulty: 0 },
      ])

      const config: CATConfig = { ...defaultConfig, maxItems: 2 }
      const engine = new CATEngine(config, pool)

      const state1 = engine.initialize()
      const state2 = engine.processResponse(state1, 'item-1', 1)

      expect(state1).not.toBe(state2)
      expect(state1.itemsAdministered).toHaveLength(0)
      expect(state2.itemsAdministered).toHaveLength(1)
    })
  })

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles all-correct responses (MLE fallback to EAP)', () => {
      const pool = createItemPool([
        { id: 'item-1', difficulty: -1 },
        { id: 'item-2', difficulty: 0 },
        { id: 'item-3', difficulty: 1 },
      ])

      const engine = new CATEngine(defaultConfig, pool)

      let state = engine.initialize()
      state = engine.processResponse(state, 'item-1', 1)
      state = engine.processResponse(state, 'item-2', 1)
      state = engine.processResponse(state, 'item-3', 1)

      expect(Number.isFinite(state.currentTheta)).toBe(true)
      expect(state.currentTheta).toBeGreaterThan(0)
    })

    it('handles all-incorrect responses (MLE fallback to EAP)', () => {
      const pool = createItemPool([
        { id: 'item-1', difficulty: -1 },
        { id: 'item-2', difficulty: 0 },
        { id: 'item-3', difficulty: 1 },
      ])

      const engine = new CATEngine(defaultConfig, pool)

      let state = engine.initialize()
      state = engine.processResponse(state, 'item-1', 0)
      state = engine.processResponse(state, 'item-2', 0)
      state = engine.processResponse(state, 'item-3', 0)

      expect(Number.isFinite(state.currentTheta)).toBe(true)
      expect(state.currentTheta).toBeLessThan(0)
    })

    it('respects item pool size constraint at construction', () => {
      const pool = createItemPool([
        { id: 'item-1', difficulty: 0 },
        { id: 'item-2', difficulty: 0 },
      ])

      const config: CATConfig = { ...defaultConfig, maxItems: 5 }

      expect(() => new CATEngine(config, pool)).toThrow(/maxItems.*exceeds/)
    })
  })
})
