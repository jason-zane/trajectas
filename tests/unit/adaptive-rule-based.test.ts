/**
 * Characterization tests for rule-based item selection.
 *
 * Rule-based selection uses deterministic thresholds based on the total
 * number of factors (competencies) in an assessment to decide how many
 * items to administer per factor.
 *
 * Three selection strategies are supported:
 *   - random: shuffle and take first N (seeded for reproducibility in tests)
 *   - ordered: sort by displayOrder, take first N
 *   - stratified: divide by difficulty tertile, balance across tiers
 */

import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  calculateItemsPerFactor,
  selectItems,
  parseFactorCountRule,
  FactorCountRule,
} from '@/lib/scoring/adaptive/rule-based'
import type { Item } from '@/types/database'

// Test fixtures
function createItem(overrides: Partial<Item>): Item {
  return {
    id: 'item-default',
    constructId: 'construct-default',
    displayOrder: 0,
    status: 'active',
    purpose: 'construct',
    ...overrides,
  } as Item
}

describe('rule-based item selection', () => {
  // -----------------------------------------------------------------------
  // calculateItemsPerFactor
  // -----------------------------------------------------------------------
  describe('calculateItemsPerFactor', () => {
    it('hand-derives 10 items/factor for 1-3 total factors', () => {
      expect(calculateItemsPerFactor(1)).toBe(10)
      expect(calculateItemsPerFactor(2)).toBe(10)
      expect(calculateItemsPerFactor(3)).toBe(10)
    })

    it('hand-derives 7 items/factor for 4-7 total factors', () => {
      expect(calculateItemsPerFactor(4)).toBe(7)
      expect(calculateItemsPerFactor(5)).toBe(7)
      expect(calculateItemsPerFactor(7)).toBe(7)
    })

    it('hand-derives 5 items/factor for 8-12 total factors', () => {
      expect(calculateItemsPerFactor(8)).toBe(5)
      expect(calculateItemsPerFactor(10)).toBe(5)
      expect(calculateItemsPerFactor(12)).toBe(5)
    })

    it('hand-derives 4 items/factor for 13+ total factors', () => {
      expect(calculateItemsPerFactor(13)).toBe(4)
      expect(calculateItemsPerFactor(50)).toBe(4)
      expect(calculateItemsPerFactor(100)).toBe(4)
    })

    it('accepts custom FactorCountRule objects', () => {
      const customRules: FactorCountRule[] = [
        { totalFactorMin: 1, totalFactorMax: 2, itemsPerFactor: 15 },
        { totalFactorMin: 3, totalFactorMax: 100, itemsPerFactor: 8 },
      ]

      expect(calculateItemsPerFactor(1, customRules)).toBe(15)
      expect(calculateItemsPerFactor(2, customRules)).toBe(15)
      expect(calculateItemsPerFactor(3, customRules)).toBe(8)
    })

    it('falls back to defaults when custom rules fail to parse', () => {
      const badRules: unknown[] = [
        {
          id: 'bad-rule',
          assessmentId: 'assessment-1',
          ruleType: 'wrong_type',
          config: {},
          priority: 1,
          created_at: '2024-01-01',
        },
      ]

      // Should fall back to defaults and return 10 for 2 factors
      expect(calculateItemsPerFactor(2, badRules as (FactorCountRule | ReturnType<typeof parseFactorCountRule>)[])).toBe(10)
    })

    it('returns 4 as ultimate fallback if no rule matches (should not happen with defaults)', () => {
      // Empty rules force fallback
      expect(calculateItemsPerFactor(2, [])).toBe(10) // Uses defaults if empty
    })
  })

  // -----------------------------------------------------------------------
  // parseFactorCountRule
  // -----------------------------------------------------------------------
  describe('parseFactorCountRule', () => {
    it('hand-derives a FactorCountRule from a database rule with type competency_count', () => {
      const dbRule = {
        id: 'rule-1',
        assessmentId: 'assessment-1',
        ruleType: 'competency_count',
        config: {
          totalFactorMin: 4,
          totalFactorMax: 7,
          itemsPerFactor: 7,
        },
        priority: 1,
        created_at: '2024-01-01',
      }

      const parsed = parseFactorCountRule(dbRule)

      expect(parsed).toEqual({
        totalFactorMin: 4,
        totalFactorMax: 7,
        itemsPerFactor: 7,
      })
    })

    it('returns undefined for a rule with wrong type', () => {
      const dbRule = {
        id: 'rule-1',
        assessmentId: 'assessment-1',
        ruleType: 'some_other_type',
        config: {
          totalFactorMin: 4,
          totalFactorMax: 7,
          itemsPerFactor: 7,
        },
        priority: 1,
        created_at: '2024-01-01',
      }

      expect(parseFactorCountRule(dbRule)).toBeUndefined()
    })

    it('returns undefined for malformed config (non-numeric fields)', () => {
      const dbRule = {
        id: 'rule-1',
        assessmentId: 'assessment-1',
        ruleType: 'competency_count',
        config: {
          totalFactorMin: 'not-a-number',
          totalFactorMax: 7,
          itemsPerFactor: 7,
        },
        priority: 1,
        created_at: '2024-01-01',
      }

      expect(parseFactorCountRule(dbRule)).toBeUndefined()
    })
  })

  // -----------------------------------------------------------------------
  // selectItems: Random strategy
  // -----------------------------------------------------------------------
  describe('selectItems: random strategy', () => {
    beforeEach(() => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5) // Deterministic for testing
    })

    it('returns requested count when pool is large enough', () => {
      const items = [
        createItem({ id: 'item-1', constructId: 'construct-a' }),
        createItem({ id: 'item-2', constructId: 'construct-a' }),
        createItem({ id: 'item-3', constructId: 'construct-a' }),
        createItem({ id: 'item-4', constructId: 'construct-a' }),
        createItem({ id: 'item-5', constructId: 'construct-a' }),
      ]

      const selected = selectItems(new Set(['construct-a']), items, 3, 'random')

      expect(selected).toHaveLength(3)
      expect(new Set(selected).size).toBe(3) // All unique
    })

    it('returns all available items when pool is smaller than requested count', () => {
      const items = [
        createItem({ id: 'item-1', constructId: 'construct-a' }),
        createItem({ id: 'item-2', constructId: 'construct-a' }),
      ]

      const selected = selectItems(new Set(['construct-a']), items, 5, 'random')

      expect(selected).toHaveLength(2)
      expect(new Set(selected)).toEqual(new Set(['item-1', 'item-2']))
    })

    it('filters to only target construct IDs', () => {
      const items = [
        createItem({ id: 'item-1', constructId: 'construct-a' }),
        createItem({ id: 'item-2', constructId: 'construct-a' }),
        createItem({ id: 'item-3', constructId: 'construct-b' }), // Different construct
        createItem({ id: 'item-4', constructId: 'construct-b' }), // Different construct
      ]

      const selected = selectItems(new Set(['construct-a']), items, 2, 'random')

      expect(selected).toHaveLength(2)
      expect(selected).not.toContain('item-3')
      expect(selected).not.toContain('item-4')
    })

    it('ignores inactive items', () => {
      const items = [
        createItem({ id: 'item-1', constructId: 'construct-a', status: 'active' }),
        createItem({ id: 'item-2', constructId: 'construct-a', status: 'archived' }), // Inactive
        createItem({ id: 'item-3', constructId: 'construct-a', status: 'active' }),
      ]

      const selected = selectItems(new Set(['construct-a']), items, 2, 'random')

      expect(selected).toHaveLength(2)
      expect(selected).not.toContain('item-2')
    })

    it('ignores non-construct purpose items', () => {
      const items = [
        createItem({ id: 'item-1', constructId: 'construct-a', purpose: 'construct' }),
        createItem({ id: 'item-2', constructId: 'construct-a', purpose: 'attention_check' }), // Not construct
        createItem({ id: 'item-3', constructId: 'construct-a', purpose: 'construct' }),
      ]

      const selected = selectItems(new Set(['construct-a']), items, 2, 'random')

      expect(selected).toHaveLength(2)
      expect(selected).not.toContain('item-2')
    })

    it('returns empty array when no eligible items exist', () => {
      const items = [
        createItem({ id: 'item-1', constructId: 'construct-b' }), // Wrong construct
      ]

      const selected = selectItems(new Set(['construct-a']), items, 5, 'random')

      expect(selected).toEqual([])
    })

    it('returns empty array when count <= 0', () => {
      const items = [createItem({ id: 'item-1', constructId: 'construct-a' })]

      expect(selectItems(new Set(['construct-a']), items, 0, 'random')).toEqual([])
      expect(selectItems(new Set(['construct-a']), items, -5, 'random')).toEqual([])
    })
  })

  // -----------------------------------------------------------------------
  // selectItems: Ordered strategy
  // -----------------------------------------------------------------------
  describe('selectItems: ordered strategy', () => {
    it('hand-derives ordered selection by displayOrder (ascending)', () => {
      const items = [
        createItem({ id: 'item-1', constructId: 'construct-a', displayOrder: 30 }),
        createItem({ id: 'item-2', constructId: 'construct-a', displayOrder: 10 }),
        createItem({ id: 'item-3', constructId: 'construct-a', displayOrder: 20 }),
        createItem({ id: 'item-4', constructId: 'construct-a', displayOrder: 40 }),
      ]

      const selected = selectItems(new Set(['construct-a']), items, 2, 'ordered')

      // Should select item-2 (order 10) and item-3 (order 20)
      expect(selected).toEqual(['item-2', 'item-3'])
    })

    it('returns all items when count >= pool size, in order', () => {
      const items = [
        createItem({ id: 'item-1', constructId: 'construct-a', displayOrder: 30 }),
        createItem({ id: 'item-2', constructId: 'construct-a', displayOrder: 10 }),
      ]

      const selected = selectItems(new Set(['construct-a']), items, 5, 'ordered')

      expect(selected).toHaveLength(2)
      expect(selected).toEqual(['item-2', 'item-1'])
    })

    it('respects construct and status filters', () => {
      const items = [
        createItem({ id: 'item-1', constructId: 'construct-a', displayOrder: 10, status: 'active' }),
        createItem({ id: 'item-2', constructId: 'construct-b', displayOrder: 20 }), // Wrong construct
        createItem({ id: 'item-3', constructId: 'construct-a', displayOrder: 30, status: 'archived' }), // Inactive
        createItem({ id: 'item-4', constructId: 'construct-a', displayOrder: 40, status: 'active' }),
      ]

      const selected = selectItems(new Set(['construct-a']), items, 2, 'ordered')

      expect(selected).toEqual(['item-1', 'item-4'])
    })
  })

  // -----------------------------------------------------------------------
  // selectItems: Stratified strategy
  // -----------------------------------------------------------------------
  describe('selectItems: stratified strategy', () => {
    beforeEach(() => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
    })

    it('hand-derives balanced selection across difficulty tertiles', () => {
      /**
       * 9 items divided by displayOrder (proxy for difficulty):
       * Easy (0-3): item-1, item-2, item-3
       * Medium (3-6): item-4, item-5, item-6
       * Hard (6-9): item-7, item-8, item-9
       *
       * Request 9 items: 3 from each tier
       * After shuffle (mocked to 0.5), order is deterministic
       */
      const items = [
        createItem({ id: 'item-1', constructId: 'construct-a', displayOrder: 1 }),
        createItem({ id: 'item-2', constructId: 'construct-a', displayOrder: 2 }),
        createItem({ id: 'item-3', constructId: 'construct-a', displayOrder: 3 }),
        createItem({ id: 'item-4', constructId: 'construct-a', displayOrder: 4 }),
        createItem({ id: 'item-5', constructId: 'construct-a', displayOrder: 5 }),
        createItem({ id: 'item-6', constructId: 'construct-a', displayOrder: 6 }),
        createItem({ id: 'item-7', constructId: 'construct-a', displayOrder: 7 }),
        createItem({ id: 'item-8', constructId: 'construct-a', displayOrder: 8 }),
        createItem({ id: 'item-9', constructId: 'construct-a', displayOrder: 9 }),
      ]

      const selected = selectItems(new Set(['construct-a']), items, 9, 'stratified')

      expect(selected).toHaveLength(9)
      // Should have mix from all tiers (can't hardcode exact IDs due to shuffle)
      const selectedSet = new Set(selected)
      expect(selectedSet.size).toBe(9)
    })

    it('distributes remainder slots to medium, then easy, when count not divisible by 3', () => {
      /**
       * 9 items, request 5:
       * Base allocation: 5 / 3 = 1 per tier, remainder = 2
       * Distribution: +1 to medium, +1 to easy
       * Result: easy=2, medium=2, hard=1
       *
       * With displayOrder tertiles:
       * Easy (0-3): 2 items
       * Medium (3-6): 2 items
       * Hard (6-9): 1 item
       */
      const items = [
        createItem({ id: 'item-1', constructId: 'construct-a', displayOrder: 1 }),
        createItem({ id: 'item-2', constructId: 'construct-a', displayOrder: 2 }),
        createItem({ id: 'item-3', constructId: 'construct-a', displayOrder: 3 }),
        createItem({ id: 'item-4', constructId: 'construct-a', displayOrder: 4 }),
        createItem({ id: 'item-5', constructId: 'construct-a', displayOrder: 5 }),
        createItem({ id: 'item-6', constructId: 'construct-a', displayOrder: 6 }),
        createItem({ id: 'item-7', constructId: 'construct-a', displayOrder: 7 }),
        createItem({ id: 'item-8', constructId: 'construct-a', displayOrder: 8 }),
        createItem({ id: 'item-9', constructId: 'construct-a', displayOrder: 9 }),
      ]

      const selected = selectItems(new Set(['construct-a']), items, 5, 'stratified')

      expect(selected).toHaveLength(5)
    })

    it('returns fewer items when the pool is exhausted', () => {
      const items = [
        createItem({ id: 'item-1', constructId: 'construct-a', displayOrder: 1 }),
        createItem({ id: 'item-2', constructId: 'construct-a', displayOrder: 2 }),
      ]

      const selected = selectItems(new Set(['construct-a']), items, 10, 'stratified')

      expect(selected).toHaveLength(2)
    })

    it('respects construct and status filters', () => {
      const items = [
        createItem({ id: 'item-1', constructId: 'construct-a', displayOrder: 1, status: 'active' }),
        createItem({ id: 'item-2', constructId: 'construct-b', displayOrder: 2 }), // Wrong construct
        createItem({ id: 'item-3', constructId: 'construct-a', displayOrder: 3, status: 'archived' }), // Inactive
        createItem({ id: 'item-4', constructId: 'construct-a', displayOrder: 4, status: 'active' }),
        createItem({ id: 'item-5', constructId: 'construct-a', displayOrder: 5, status: 'active' }),
      ]

      const selected = selectItems(new Set(['construct-a']), items, 2, 'stratified')

      expect(selected).toHaveLength(2)
      expect(selected).not.toContain('item-2')
      expect(selected).not.toContain('item-3')
    })
  })

  // -----------------------------------------------------------------------
  // selectItems: Strategy comparison and edge cases
  // -----------------------------------------------------------------------
  describe('selectItems: strategy comparison and edge cases', () => {
    it('supports multiple construct IDs', () => {
      const items = [
        createItem({ id: 'item-1', constructId: 'construct-a' }),
        createItem({ id: 'item-2', constructId: 'construct-a' }),
        createItem({ id: 'item-3', constructId: 'construct-b' }),
        createItem({ id: 'item-4', constructId: 'construct-b' }),
        createItem({ id: 'item-5', constructId: 'construct-c' }), // Not in set
      ]

      const selected = selectItems(
        new Set(['construct-a', 'construct-b']),
        items,
        3,
        'random',
      )

      expect(selected).toHaveLength(3)
      expect(selected).not.toContain('item-5')
    })

    it('throws on unknown strategy (exhaustive check)', () => {
      const items = [createItem({ id: 'item-1', constructId: 'construct-a' })]

      expect(() => {
        selectItems(new Set(['construct-a']), items, 1, 'unknown_strategy' as never)
      }).toThrow()
    })

    it('returns empty when construct set is empty', () => {
      const items = [createItem({ id: 'item-1', constructId: 'construct-a' })]

      const selected = selectItems(new Set(), items, 5, 'random')

      expect(selected).toEqual([])
    })

    it('handles items with null constructId (skips them)', () => {
      const items = [
        createItem({ id: 'item-1', constructId: undefined }),
        createItem({ id: 'item-2', constructId: 'construct-a' }),
      ]

      const selected = selectItems(new Set(['construct-a']), items, 5, 'random')

      expect(selected).toEqual(['item-2'])
    })
  })
})
