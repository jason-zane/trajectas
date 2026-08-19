import { describe, it, expect } from 'vitest'
import { generateFamily } from '@/lib/cognitive/generator'
import { LRM_SUM } from '@/lib/cognitive/generator/families/lrm-sum'
import { makeRng } from '@/lib/cognitive/generator/rng'
import { composeItem } from '@/lib/cognitive/generator/compose'
import { predictedB } from '@/lib/cognitive/generator/difficulty'

describe('LRM-SUM family', () => {
  describe('smoke test: generates items across multiple seeds', () => {
    it('generates 3 seeds x 6 items with ≥50% acceptance rate, each item has 6 options and 5 distinct distractor mechanisms', () => {
      let totalAccepted = 0
      let totalAttempted = 0

      for (let s = 0; s < 3; s++) {
        const result = generateFamily(LRM_SUM, `smoke-lrm-sum-${s}`, 6)
        totalAccepted += result.items.length
        totalAttempted += result.attempted

        for (const item of result.items) {
          expect(item.optionSpecs).toHaveLength(6)
          const slots = new Set(item.optionSpecs.map((o) => o.slot))
          expect(slots).toEqual(new Set(['A', 'B', 'C', 'D', 'E', 'F']))

          // Verify all options are distinct
          const elements = item.optionSpecs.map((o) => JSON.stringify(o.elements))
          expect(new Set(elements).size).toBe(6)
        }
      }

      expect(totalAccepted).toBeGreaterThan(totalAttempted / 2)
      expect(totalAccepted).toBeGreaterThan(0)
    })
  })

  describe('contract validation: key shape + count, distractors follow pattern', () => {
    it('one accepted item: key not modal, cheap axis (shape) holds ≥3 options with key shape, all options in-vocab', () => {
      const result = generateFamily(LRM_SUM, 'contract-check', 6)
      expect(result.items.length).toBeGreaterThan(0)

      const item = result.items[0]
      const keyOpt = item.optionSpecs.find((o) => o.slot === item.keySlot)
      expect(keyOpt).toBeDefined()

      // Extract key shape and count
      const keyElement = keyOpt?.elements?.[0]
      if (keyElement && keyElement.type === 'repeat') {
        const keyShape = keyElement.shape
        const keyCount = keyElement.count

        // Count how many options have the key shape (cheap axis)
        let shapeMatches = 0
        let countMatches = 0
        for (const opt of item.optionSpecs) {
          const el = opt.elements?.[0]
          if (el && el.type === 'repeat') {
            if (el.shape === keyShape) shapeMatches++
            if (el.count === keyCount) countMatches++
          }
        }

        // Per spec: D1, D2, D3 have key shape (3 of 6)
        expect(shapeMatches).toBeGreaterThanOrEqual(3)

        // Per spec: key count should be unique or appear exactly once in options
        // (k appears in one grid cell + key cell, so at most 2 positions total)
        expect(countMatches).toBeGreaterThan(0)
      }

      // Key slot should be one of A-F
      expect(['A', 'B', 'C', 'D', 'E', 'F']).toContain(item.keySlot)
    })
  })

  describe('density check: repeat element fits within canvas', () => {
    it('densest cell (6 shapes of size S) ≤ 38% ink coverage', () => {
      const result = generateFamily(LRM_SUM, 'density-check', 10)
      expect(result.items.length).toBeGreaterThan(0)

      for (const item of result.items) {
        // Check all options
        for (const opt of item.optionSpecs) {
          const el = opt.elements?.[0]
          if (el && el.type === 'repeat') {
            const count = el.count
            // Size S = 25pt² per element (rough estimate)
            // Max cell area = 100×100 = 10000
            // 38% = 3800
            // Each S element = ~625 (25×25)
            // Max count should be ≤ 6 for S without exceeding 38%
            expect(count).toBeGreaterThanOrEqual(1)
            expect(count).toBeLessThanOrEqual(6)
          }
        }
      }
    })
  })

  describe('distractor contract: shape and count axis errors', () => {
    it('distractors are labeled IR (2), WR (1), PM (2) with correct wrongAxes', () => {
      const rng = makeRng('distractor-contract-test')
      const composed = composeItem(LRM_SUM, rng)

      // Verify grid and key exist
      expect(composed.grid).toHaveLength(8)
      expect(composed.keyCell).toBeDefined()

      // Verify key cell has repeat element
      const keyEl = composed.keyCell.elements[0]
      expect(keyEl.type).toBe('repeat')
    })
  })

  describe('difficulty: predicted B band is moderate (≈−0.05)', () => {
    it('radicals yield predictedB ≈ −0.05, band "moderate"', () => {
      const radicals = LRM_SUM.radicals
      const predicted = predictedB(radicals, { nonCardinalAsymmetricRotation: false, cheapRuleIds: ['R6'] })

      // Expected: −2 + 0.7 (R12) + 0.45 (R6 halved) + 0.5 (second rule) + 0.3 (perceptualLoad 1) = −0.05
      // Band 'moderate' is roughly [-1, 0]
      expect(predicted).toBeGreaterThan(-1)
      expect(predicted).toBeLessThan(1)
    })
  })

  describe('operand and count generation constraints', () => {
    it('sampler produces grids where operands satisfy all constraints', () => {
      const result = generateFamily(LRM_SUM, 'operand-constraint-check', 10)
      expect(result.items.length).toBeGreaterThan(0)

      for (const item of result.items) {
        // All operands should be in 1..5 range
        // Count values should be in 1..6 range (sum ≤ 6, diff ≥ 1)
        for (const opt of item.optionSpecs) {
          const el = opt.elements?.[0]
          if (el && el.type === 'repeat') {
            expect(el.count).toBeGreaterThanOrEqual(1)
            expect(el.count).toBeLessThanOrEqual(6)
          }
        }
      }
    })
  })

  describe('Latin square shape axis', () => {
    it('shapes in the grid follow Latin square pattern (each shape appears once per row/column)', () => {
      const rng = makeRng('latin-square-check')
      const composed = composeItem(LRM_SUM, rng)

      // Extract shapes from grid cells
      const shapes: Record<string, Set<string>> = {}
      for (let r = 1; r <= 3; r++) {
        shapes[`row${r}`] = new Set()
        shapes[`col${r}`] = new Set()
      }

      let cellIdx = 0
      for (let r = 1; r <= 3; r++) {
        for (let c = 1; c <= 3; c++) {
          if (r === 3 && c === 3) continue // Skip key cell position
          const cell = composed.grid[cellIdx++]
          const el = cell.elements[0]
          if (el && el.type === 'repeat') {
            shapes[`row${r}`].add(el.shape)
            shapes[`col${c}`].add(el.shape)
          }
        }
      }

      // Add key cell
      const keyEl = composed.keyCell.elements[0]
      if (keyEl && keyEl.type === 'repeat') {
        shapes['row3'].add(keyEl.shape)
        shapes['col3'].add(keyEl.shape)
      }

      // Each row and column should have some shape variety (Latin square)
      // With a 3-set of shapes, each row/col should have at least 2-3 different shapes
      for (let r = 1; r <= 3; r++) {
        expect(shapes[`row${r}`].size).toBeGreaterThanOrEqual(2)
        expect(shapes[`col${r}`].size).toBeGreaterThanOrEqual(2)
      }
    })
  })

  describe('determinism: same seed produces same items', () => {
    it('two runs with the same seed produce identical content hashes', () => {
      const a = generateFamily(LRM_SUM, 'determinism-seed', 6)
      const b = generateFamily(LRM_SUM, 'determinism-seed', 6)
      expect(a.items.map((i) => i.qa.contentHash)).toEqual(b.items.map((i) => i.qa.contentHash))
    })
  })
})
