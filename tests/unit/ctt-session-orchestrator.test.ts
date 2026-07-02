/**
 * Characterization tests for CTT session scoring logic.
 *
 * Note: scoreSessionCTT is tightly coupled to DB queries with deep chaining,
 * making it unsuitable for standard unit testing without invasive refactoring.
 *
 * These tests verify the *core algorithmic components* used by the session scorer:
 * 1. POMP calculation (response → percentage correct): forward and reverse-scored
 * 2. Weighted construct-level aggregation
 * 3. Factor-level rollup via weighted construct averages
 *
 * Full end-to-end integration tests (DB → scores) are in tests/integration/.
 *
 * Each test hand-derives expected values, serving as regression tests
 * to ensure changes to the scoring formula are intentional.
 */

import { describe, expect, it } from 'vitest'

import { deriveItemBounds } from '@/lib/scoring/ctt-session'
import { toPomp } from '@/lib/scoring/transforms'

/**
 * POMP (Percentage of Maximum Possible) calculation — mirrors the per-response
 * step in ctt-session.ts: reverse-score, then delegate to the shared
 * (clamped) toPomp transform.
 *
 * Formula:
 *   effectiveValue = reverseScored ? (maxValue - response + minValue) : response
 *   POMP = clamp((effectiveValue - minValue) / (maxValue - minValue) * 100, 0, 100)
 */
function calculatePOMP(
  responseValue: number,
  minValue: number,
  maxValue: number,
  reverseScored: boolean,
): number {
  const effectiveValue = reverseScored ? maxValue - responseValue + minValue : responseValue
  return toPomp(effectiveValue, minValue, maxValue)
}

/**
 * Weighted construct score aggregation — core logic from ctt-session.ts lines 134-143.
 *
 * For each construct, average the POMP values weighted by item weights.
 */
function calculateConstructScore(
  pompAndWeights: Array<{ pompValue: number; weight: number }>,
): number {
  if (pompAndWeights.length === 0) return 0

  let weightedSum = 0
  let totalWeight = 0
  for (const item of pompAndWeights) {
    weightedSum += item.pompValue * item.weight
    totalWeight += item.weight
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0
}

/**
 * Factor-level rollup — core logic from ctt-session.ts lines 188-212.
 *
 * For each factor, average the construct scores weighted by factor-construct links.
 */
function calculateFactorScore(
  constructScores: Map<string, number>,
  factorConstructLinks: Array<{ constructId: string; weight: number }>,
): number {
  if (factorConstructLinks.length === 0) return 0

  let weightedSum = 0
  let totalWeight = 0

  for (const link of factorConstructLinks) {
    const cs = constructScores.get(link.constructId)
    if (cs === undefined) continue

    weightedSum += cs * link.weight
    totalWeight += link.weight
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0
}

describe('CTT session scoring logic', () => {
  // -----------------------------------------------------------------------
  // POMP calculation (forward-scored items)
  // -----------------------------------------------------------------------
  describe('POMP calculation — forward-scored items', () => {
    it('hand-derives POMP for a middle response (1-5 scale)', () => {
      /**
       * Response: 3 on a 1-5 scale
       * Effective: 3 (not reverse-scored)
       * POMP = (3 - 1) / (5 - 1) * 100 = 2/4 * 100 = 50%
       */
      const pomp = calculatePOMP(3, 1, 5, false)
      expect(pomp).toBeCloseTo(50, 1)
    })

    it('hand-derives POMP for a ceiling response (100%)', () => {
      /**
       * Response: 5 on a 1-5 scale
       * Effective: 5
       * POMP = (5 - 1) / (5 - 1) * 100 = 100%
       */
      const pomp = calculatePOMP(5, 1, 5, false)
      expect(pomp).toBeCloseTo(100, 1)
    })

    it('hand-derives POMP for a floor response (0%)', () => {
      /**
       * Response: 1 on a 1-5 scale
       * Effective: 1
       * POMP = (1 - 1) / (5 - 1) * 100 = 0%
       */
      const pomp = calculatePOMP(1, 1, 5, false)
      expect(pomp).toBeCloseTo(0, 1)
    })

    it('handles different scale ranges (0-10 scale)', () => {
      /**
       * Response: 5 on a 0-10 scale
       * Effective: 5
       * POMP = (5 - 0) / (10 - 0) * 100 = 50%
       */
      const pomp = calculatePOMP(5, 0, 10, false)
      expect(pomp).toBeCloseTo(50, 1)
    })

    it('returns 0 when range is 0 (degenerate scale)', () => {
      const pomp = calculatePOMP(5, 5, 5, false)
      expect(pomp).toBe(0)
    })
  })

  // -----------------------------------------------------------------------
  // POMP calculation (reverse-scored items)
  // -----------------------------------------------------------------------
  describe('POMP calculation — reverse-scored items', () => {
    it('hand-derives POMP for a reverse-scored item at floor', () => {
      /**
       * Response: 1 on a 1-5 scale, REVERSE-SCORED
       * Effective: 5 - 1 + 1 = 5
       * POMP = (5 - 1) / (5 - 1) * 100 = 100%
       */
      const pomp = calculatePOMP(1, 1, 5, true)
      expect(pomp).toBeCloseTo(100, 1)
    })

    it('hand-derives POMP for a reverse-scored item at ceiling', () => {
      /**
       * Response: 5 on a 1-5 scale, REVERSE-SCORED
       * Effective: 5 - 5 + 1 = 1
       * POMP = (1 - 1) / (5 - 1) * 100 = 0%
       */
      const pomp = calculatePOMP(5, 1, 5, true)
      expect(pomp).toBeCloseTo(0, 1)
    })

    it('hand-derives POMP for a reverse-scored item at midpoint', () => {
      /**
       * Response: 3 on a 1-5 scale, REVERSE-SCORED
       * Effective: 5 - 3 + 1 = 3
       * POMP = (3 - 1) / (5 - 1) * 100 = 50%
       */
      const pomp = calculatePOMP(3, 1, 5, true)
      expect(pomp).toBeCloseTo(50, 1)
    })

    it('hand-derives POMP for a reverse-scored item on a 0-10 scale', () => {
      /**
       * Response: 2 on a 0-10 scale, REVERSE-SCORED
       * Effective: 10 - 2 + 0 = 8
       * POMP = (8 - 0) / (10 - 0) * 100 = 80%
       */
      const pomp = calculatePOMP(2, 0, 10, true)
      expect(pomp).toBeCloseTo(80, 1)
    })
  })

  // -----------------------------------------------------------------------
  // Item bounds derivation (deriveItemBounds — real implementation)
  // -----------------------------------------------------------------------
  describe('item bounds derivation', () => {
    it('derives 0–1 bounds for the seeded binary format from its item options', () => {
      // Seeded binary config (00004_seed_library_data.sql) carries no
      // minValue/maxValue/points — the 0/1 option values are the scale.
      const bounds = deriveItemBounds(
        { options: 2, labels: { '0': 'No', '1': 'Yes' } },
        [0, 1],
      )
      expect(bounds).toEqual({ minValue: 0, maxValue: 1 })
    })

    it('prefers explicit config minValue/maxValue over option values', () => {
      const bounds = deriveItemBounds({ minValue: 0, maxValue: 10 }, [1, 2, 3])
      expect(bounds).toEqual({ minValue: 0, maxValue: 10 })
    })

    it('falls back to config points for a Likert format without options', () => {
      const bounds = deriveItemBounds(
        { points: 5, anchors: { '1': 'Strongly Disagree', '5': 'Strongly Agree' } },
        [],
      )
      expect(bounds).toEqual({ minValue: 1, maxValue: 5 })
    })

    it('defaults to 1–5 when config and options carry no bounds', () => {
      expect(deriveItemBounds({}, [])).toEqual({ minValue: 1, maxValue: 5 })
    })

    it('derives bounds from unordered option values (forced choice)', () => {
      const bounds = deriveItemBounds({ options: 2 }, [2, 1])
      expect(bounds).toEqual({ minValue: 1, maxValue: 2 })
    })

    it('derives 0–1 bounds from seeded binary label keys when the item has no options', () => {
      // AI-accepted items get no item_options; the runner's binary component
      // falls back to Yes(1)/No(0), so the config's label keys are the scale.
      const bounds = deriveItemBounds(
        { options: 2, labels: { '0': 'No', '1': 'Yes' } },
        [],
      )
      expect(bounds).toEqual({ minValue: 0, maxValue: 1 })
    })

    it('derives bounds from trueValue/falseValue (admin-form binary config) without options', () => {
      const bounds = deriveItemBounds(
        { trueLabel: 'True', falseLabel: 'False', trueValue: 1, falseValue: 0 },
        [],
      )
      expect(bounds).toEqual({ minValue: 0, maxValue: 1 })
    })

    it('ignores degenerate label keys (single value) and falls through to the default', () => {
      expect(deriveItemBounds({ labels: { '1': 'Only' } }, [])).toEqual({
        minValue: 1,
        maxValue: 5,
      })
    })

    it('treats a bare binary format as 0–1 (runner hardcodes Yes=1/No=0 without options)', () => {
      expect(deriveItemBounds({ options: 2 }, [], 'binary')).toEqual({
        minValue: 0,
        maxValue: 1,
      })
    })

    it('does not apply the binary net to other format types', () => {
      expect(deriveItemBounds({ options: 2 }, [], 'forced_choice')).toEqual({
        minValue: 1,
        maxValue: 5,
      })
    })
  })

  // -----------------------------------------------------------------------
  // POMP calculation (binary items — regression for the 1–5 default bug)
  // -----------------------------------------------------------------------
  describe('POMP calculation — binary items', () => {
    it('scores a "No" (0) response as 0 POMP, not negative', () => {
      /**
       * Regression: with the old hardcoded 1–5 default a binary 0 scored
       * (0 - 1) / (5 - 1) * 100 = -25 POMP.
       */
      const { minValue, maxValue } = deriveItemBounds(
        { options: 2, labels: { '0': 'No', '1': 'Yes' } },
        [0, 1],
      )
      expect(calculatePOMP(0, minValue, maxValue, false)).toBe(0)
    })

    it('scores a "Yes" (1) response as 100 POMP', () => {
      const { minValue, maxValue } = deriveItemBounds(
        { options: 2, labels: { '0': 'No', '1': 'Yes' } },
        [0, 1],
      )
      expect(calculatePOMP(1, minValue, maxValue, false)).toBe(100)
    })

    it('reverse-scores binary responses within 0–1 bounds', () => {
      expect(calculatePOMP(0, 0, 1, true)).toBe(100)
      expect(calculatePOMP(1, 0, 1, true)).toBe(0)
    })

    it('clamps out-of-bounds responses instead of going negative or above 100', () => {
      expect(calculatePOMP(0, 1, 5, false)).toBe(0)
      expect(calculatePOMP(6, 1, 5, false)).toBe(100)
    })
  })

  // -----------------------------------------------------------------------
  // Construct-level aggregation (weighted mean POMP)
  // -----------------------------------------------------------------------
  describe('construct-level score aggregation', () => {
    it('hand-derives unweighted mean of POMP values', () => {
      /**
       * Two items with equal weight (1.0):
       *   Item 1: POMP = 75%, weight = 1.0
       *   Item 2: POMP = 100%, weight = 1.0
       * Construct score = (75*1 + 100*1) / (1 + 1) = 87.5%
       */
      const items = [
        { pompValue: 75, weight: 1.0 },
        { pompValue: 100, weight: 1.0 },
      ]
      const score = calculateConstructScore(items)
      expect(score).toBeCloseTo(87.5, 1)
    })

    it('hand-derives weighted mean with unequal weights', () => {
      /**
       * Two items with different weights:
       *   Item 1: POMP = 75%, weight = 1.0
       *   Item 2: POMP = 50%, weight = 2.0
       * Construct score = (75*1 + 50*2) / (1 + 2) = 175/3 = 58.33%
       */
      const items = [
        { pompValue: 75, weight: 1.0 },
        { pompValue: 50, weight: 2.0 },
      ]
      const score = calculateConstructScore(items)
      expect(score).toBeCloseTo(58.33, 1)
    })

    it('returns 0 for empty item list', () => {
      const score = calculateConstructScore([])
      expect(score).toBe(0)
    })

    it('handles a single item', () => {
      const items = [{ pompValue: 75, weight: 1.0 }]
      const score = calculateConstructScore(items)
      expect(score).toBeCloseTo(75, 1)
    })

    it('returns 0 when all weights sum to 0', () => {
      const items = [{ pompValue: 75, weight: 0 }]
      const score = calculateConstructScore(items)
      expect(score).toBe(0)
    })
  })

  // -----------------------------------------------------------------------
  // Factor-level rollup (weighted construct average)
  // -----------------------------------------------------------------------
  describe('factor-level score rollup', () => {
    it('hand-derives unweighted mean of construct scores', () => {
      /**
       * Factor with two constructs, equal weights:
       *   Construct A: 87.5%, weight = 1.0
       *   Construct B: 60%, weight = 1.0
       * Factor score = (87.5*1 + 60*1) / (1 + 1) = 73.75%
       */
      const constructScores = new Map([
        ['construct-a', 87.5],
        ['construct-b', 60],
      ])

      const factorConstructLinks = [
        { constructId: 'construct-a', weight: 1.0 },
        { constructId: 'construct-b', weight: 1.0 },
      ]

      const score = calculateFactorScore(constructScores, factorConstructLinks)
      expect(score).toBeCloseTo(73.75, 1)
    })

    it('hand-derives weighted mean of construct scores', () => {
      /**
       * Factor with two constructs, unequal weights:
       *   Construct A: 87.5%, weight = 1.0
       *   Construct B: 60%, weight = 3.0
       * Factor score = (87.5*1 + 60*3) / (1 + 3) = 267.5/4 = 66.875%
       */
      const constructScores = new Map([
        ['construct-a', 87.5],
        ['construct-b', 60],
      ])

      const factorConstructLinks = [
        { constructId: 'construct-a', weight: 1.0 },
        { constructId: 'construct-b', weight: 3.0 },
      ]

      const score = calculateFactorScore(constructScores, factorConstructLinks)
      expect(score).toBeCloseTo(66.875, 1)
    })

    it('skips missing construct scores gracefully', () => {
      /**
       * Factor links to two constructs, but only one has a score:
       *   Construct A: 80%, weight = 1.0
       *   Construct B: (missing)
       * Factor score = (80*1) / 1 = 80%
       */
      const constructScores = new Map([['construct-a', 80]])

      const factorConstructLinks = [
        { constructId: 'construct-a', weight: 1.0 },
        { constructId: 'construct-b', weight: 1.0 }, // Missing
      ]

      const score = calculateFactorScore(constructScores, factorConstructLinks)
      expect(score).toBeCloseTo(80, 1)
    })

    it('returns 0 for empty links list', () => {
      const constructScores = new Map([['construct-a', 80]])
      const score = calculateFactorScore(constructScores, [])
      expect(score).toBe(0)
    })

    it('returns 0 when all construct links are missing', () => {
      const constructScores = new Map() // Empty

      const factorConstructLinks = [
        { constructId: 'construct-a', weight: 1.0 },
        { constructId: 'construct-b', weight: 1.0 },
      ]

      const score = calculateFactorScore(constructScores, factorConstructLinks)
      expect(score).toBe(0)
    })
  })

  // -----------------------------------------------------------------------
  // Full end-to-end scenarios (combining all three steps)
  // -----------------------------------------------------------------------
  describe('end-to-end scenario', () => {
    it('hand-derives full assessment score from responses', () => {
      /**
       * Session with 4 items across 2 constructs, 2 factors:
       *
       * Construct A:
       *   Item 1: response=4, weight=1.0, 1-5 scale → POMP=75%
       *   Item 2: response=5, weight=1.0, 1-5 scale → POMP=100%
       *   Construct A score = (75+100)/2 = 87.5%
       *
       * Construct B:
       *   Item 3: response=2, reverse-scored, weight=2.0, 1-5 scale
       *     effective = 5-2+1 = 4 → POMP=75%
       *   Item 4: response=3, weight=1.0, 1-5 scale → POMP=50%
       *   Construct B score = (75*2 + 50*1)/(2+1) = 200/3 = 66.67%
       *
       * Factor Thinking (only Construct A):
       *   Factor score = 87.5%
       *
       * Factor Executing (only Construct B):
       *   Factor score = 66.67%
       *
       * Composite = (87.5 + 66.67)/2 = 77.09%
       */

      // Step 1: Calculate POMP values for all items
      const item1POMP = calculatePOMP(4, 1, 5, false) // 75
      const item2POMP = calculatePOMP(5, 1, 5, false) // 100
      const item3POMP = calculatePOMP(2, 1, 5, true) // 75
      const item4POMP = calculatePOMP(3, 1, 5, false) // 50

      expect(item1POMP).toBeCloseTo(75, 1)
      expect(item2POMP).toBeCloseTo(100, 1)
      expect(item3POMP).toBeCloseTo(75, 1)
      expect(item4POMP).toBeCloseTo(50, 1)

      // Step 2: Aggregate to construct scores
      const constructAScore = calculateConstructScore([
        { pompValue: item1POMP, weight: 1.0 },
        { pompValue: item2POMP, weight: 1.0 },
      ])
      const constructBScore = calculateConstructScore([
        { pompValue: item3POMP, weight: 2.0 },
        { pompValue: item4POMP, weight: 1.0 },
      ])

      expect(constructAScore).toBeCloseTo(87.5, 1)
      expect(constructBScore).toBeCloseTo(66.67, 1)

      // Step 3: Aggregate to factor scores
      const constructScores = new Map([
        ['construct-a', constructAScore],
        ['construct-b', constructBScore],
      ])

      const factorThinkingScore = calculateFactorScore(constructScores, [
        { constructId: 'construct-a', weight: 1.0 },
      ])
      const factorExecutingScore = calculateFactorScore(constructScores, [
        { constructId: 'construct-b', weight: 1.0 },
      ])

      expect(factorThinkingScore).toBeCloseTo(87.5, 1)
      expect(factorExecutingScore).toBeCloseTo(66.67, 1)

      // Composite (mean of factor scores)
      const composite = (factorThinkingScore + factorExecutingScore) / 2
      expect(composite).toBeCloseTo(77.09, 1)
    })
  })
})
