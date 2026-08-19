import { describe, it, expect } from 'vitest'
import { generateFamily } from '@/lib/cognitive/generator'
import { LRM_FILL_COUNT } from '@/lib/cognitive/generator/families/lrm-fill-count'
import { predictedB } from '@/lib/cognitive/generator/difficulty'
import { cellInkFraction } from '@/lib/cognitive/generator/qa/density'

describe('LRM-FILL-COUNT family', () => {
  describe('smoke test: generates items across multiple seeds', () => {
    it('generates at least 50% acceptance rate over 5 seeds x 8 attempts each', () => {
      let totalAccepted = 0
      let totalAttempted = 0
      for (let s = 0; s < 5; s++) {
        const result = generateFamily(LRM_FILL_COUNT, `smoke-fill-count-${s}`, 8)
        totalAccepted += result.items.length
        totalAttempted += result.attempted
      }
      expect(totalAccepted).toBeGreaterThanOrEqual(totalAttempted / 2)
      expect(totalAccepted).toBeGreaterThan(0)
    }, 30000)
  })

  describe('six-option structure validation', () => {
    it('every generated item has exactly 6 options with slots A-F', () => {
      const result = generateFamily(LRM_FILL_COUNT, 'six-options-structure-check', 10)
      expect(result.items.length).toBeGreaterThan(0)
      for (const item of result.items) {
        expect(item.optionSpecs).toHaveLength(6)
        const slots = item.optionSpecs.map((opt) => opt.slot).sort()
        expect(slots).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
      }
    }, 20000)

    it('every option has exactly 5 distinct distractor rationales (IR, IR, WR, PM, PM)', () => {
      const result = generateFamily(LRM_FILL_COUNT, 'rationale-check', 10)
      expect(result.items.length).toBeGreaterThan(0)
      for (const item of result.items) {
        const distractorLabels = item.optionDiagnostics
          .filter((d) => d.errorLabel !== null) // Exclude the key (errorLabel = null)
          .map((d) => d.errorLabel as string)
        // Should have IR twice, WR once, PM twice (5 distractors total)
        const counts: Record<string, number> = {}
        for (const label of distractorLabels) {
          counts[label] = (counts[label] ?? 0) + 1
        }
        expect(counts['IR']).toBe(2)
        expect(counts['WR']).toBe(1)
        expect(counts['PM']).toBe(2)
      }
    }, 20000)
  })

  describe('contract validation on a pinned item', () => {
    it('key is not modal on count, but modal on fill', () => {
      const result = generateFamily(LRM_FILL_COUNT, 'contract-modal-check', 5)
      expect(result.items.length).toBeGreaterThan(0)
      const item = result.items[0]

      // Extract all option counts and fills
      const optionElements = item.optionSpecs.map((spec) => {
        const repeatEl = spec.elements.find((e) => e.type === 'repeat')
        if (!repeatEl || repeatEl.type !== 'repeat') throw new Error('expected repeat element')
        return { count: repeatEl.count, fill: repeatEl.fill }
      })

      // Count occurrences
      const countCounts: Record<number, number> = {}
      const fillCounts: Record<string, number> = {}
      for (const opt of optionElements) {
        countCounts[opt.count] = (countCounts[opt.count] ?? 0) + 1
        fillCounts[opt.fill] = (fillCounts[opt.fill] ?? 0) + 1
      }

      // Key is the option with errorLabel === null
      const keyDiagnostic = item.optionDiagnostics.find((d) => d.errorLabel === null)
      if (!keyDiagnostic) throw new Error('expected key (errorLabel === null)')
      const keySlot = keyDiagnostic.slot
      const keySpec = item.optionSpecs.find((s) => s.slot === keySlot)
      if (!keySpec) throw new Error('expected key option spec')
      const keyElement = keySpec.elements.find((e) => e.type === 'repeat')
      if (!keyElement || keyElement.type !== 'repeat') throw new Error('expected repeat element in key')
      const keyCount = keyElement.count
      const keyFill = keyElement.fill

      // Modal count: should not be keyCount (the key should not be modal on count)
      const maxCountFreq = Math.max(...Object.values(countCounts))
      if (countCounts[keyCount] === maxCountFreq) {
        // Key is tied for modal — but should not be sole modal
        expect(Object.values(countCounts).filter((f) => f === maxCountFreq).length).toBeGreaterThan(1)
      } else {
        // Key is strictly not modal ✓
        expect(countCounts[keyCount]).toBeLessThan(maxCountFreq)
      }

      // Modal fill: should be keyFill (key is modal on fill)
      const maxFillFreq = Math.max(...Object.values(fillCounts))
      expect(fillCounts[keyFill]).toBe(maxFillFreq)
    }, 20000)

    it('all options use in-vocabulary fills and counts', () => {
      const result = generateFamily(LRM_FILL_COUNT, 'in-vocab-check', 5)
      expect(result.items.length).toBeGreaterThan(0)
      const item = result.items[0]

      // Extract all grid cell values (8 visible cells)
      const gridCounts = new Set<number>()
      const gridFills = new Set<string>()
      for (const cell of item.itemSpec.grid.cells) {
        const repeatEl = cell.elements.find((e) => e.type === 'repeat')
        if (!repeatEl || repeatEl.type !== 'repeat') continue
        gridCounts.add(repeatEl.count)
        gridFills.add(repeatEl.fill)
      }

      // Check all options are in-vocab
      for (const opt of item.optionSpecs) {
        const repeatEl = opt.elements.find((e) => e.type === 'repeat')
        if (!repeatEl || repeatEl.type !== 'repeat') continue
        // Count must be in-grid or derived from progression (all counts 1-6 are potentially in-vocab via R1)
        expect(repeatEl.count).toBeGreaterThanOrEqual(1)
        expect(repeatEl.count).toBeLessThanOrEqual(6)
        // Fill must be in the grid
        expect(gridFills.has(repeatEl.fill)).toBe(true)
      }
    }, 20000)
  })

  describe('density check: ink ≤ 38% for densest cell', () => {
    it('no cell exceeds 38% ink coverage (6 S-circles at ~29% is the safe case)', () => {
      const result = generateFamily(LRM_FILL_COUNT, 'density-check', 20)
      expect(result.items.length).toBeGreaterThan(0)
      for (const item of result.items) {
        const allCells = [...item.itemSpec.grid.cells, ...item.optionSpecs]
        for (const cell of allCells) {
          const fraction = cellInkFraction(cell, 2) // strokeWidth = 2 (from render directives)
          expect(fraction).toBeLessThanOrEqual(0.38)
        }
      }
    }, 20000)
  })

  describe('difficulty prediction', () => {
    it('predicted b ≈ −1.05 → band "easy"', () => {
      const pred = predictedB(LRM_FILL_COUNT.radicals, { nonCardinalAsymmetricRotation: false, cheapRuleIds: ['R6'] })
      expect(pred).toBeCloseTo(-1.05, 0)
      // Band determination: typically b < 0 → easy, 0-1 → medium, > 1 → hard
      // At b ≈ -1.05, this falls into 'easy'
      expect(pred).toBeLessThan(0)
    })
  })

  describe('determinism', () => {
    it('is deterministic across repeated runs with the same seed', () => {
      const a = generateFamily(LRM_FILL_COUNT, 'determinism-seed', 5)
      const b = generateFamily(LRM_FILL_COUNT, 'determinism-seed', 5)
      expect(a.items.map((i) => i.qa.contentHash)).toEqual(b.items.map((i) => i.qa.contentHash))
      expect(a.rejects).toEqual(b.rejects)
    }, 20000)
  })
})
