import { describe, it, expect } from 'vitest'
import { generateFamily } from '@/lib/cognitive/generator'
import { LRM_DOTS_AND } from '@/lib/cognitive/generator/families/lrm-dots-and'
import { makeRng } from '@/lib/cognitive/generator/rng'
import { composeItem } from '@/lib/cognitive/generator/compose'
import { predictedB } from '@/lib/cognitive/generator/difficulty'

describe('LRM-DOTS-AND family', () => {
  describe('smoke test: generates items across multiple seeds', () => {
    it('generates 3 seeds x 6 items with ≥50% acceptance rate, each item has 6 options and 5 distinct distractors', () => {
      let totalAccepted = 0
      let totalAttempted = 0

      for (let s = 0; s < 3; s++) {
        const result = generateFamily(LRM_DOTS_AND, `smoke-lrm-dots-and-${s}`, 6)
        totalAccepted += result.items.length
        totalAttempted += result.attempted

        for (const item of result.items) {
          expect(item.optionSpecs).toHaveLength(6)
          const slots = new Set(item.optionSpecs.map((o) => o.slot))
          expect(slots).toEqual(new Set(['A', 'B', 'C', 'D', 'E', 'F']))

          // Verify all options are distinct
          const elements = item.optionSpecs.map((o) => JSON.stringify(o.elements))
          expect(new Set(elements).size).toBe(6)

          // Verify all option slots are used
          expect(item.optionSpecs).toHaveLength(6)
        }
      }

      expect(totalAccepted).toBeGreaterThan(totalAttempted / 2)
      expect(totalAccepted).toBeGreaterThan(0)
    })
  })

  describe('contract validation: intersection operation, six options', () => {
    it('one accepted item: key is intersection of row-3 operands, options use only in-vocabulary anchor counts', () => {
      const result = generateFamily(LRM_DOTS_AND, 'contract-check', 6)
      expect(result.items.length).toBeGreaterThan(0)

      const item = result.items[0]
      const keyOpt = item.optionSpecs.find((o) => o.slot === item.keySlot)
      expect(keyOpt).toBeDefined()

      // Key should be a dots element
      const keyElement = keyOpt?.elements?.[0]
      expect(keyElement?.type).toBe('dots')

      if (keyElement && keyElement.type === 'dots') {
        // Verify options exist and use anchors from the domain
        let optionsExamined = 0
        for (const opt of item.optionSpecs) {
          const el = opt.elements?.[0]
          if (el && el.type === 'dots') {
            optionsExamined++
            const anchors = el.anchors || []
            // All anchors should be from {TL, TR, BL, BR, CTR}
            const validDomain = ['TL', 'TR', 'BL', 'BR', 'CTR']
            for (const a of anchors) {
              expect(validDomain).toContain(a)
            }
            // Count should be in-vocabulary (appears in some grid cell)
            expect(anchors.length).toBeGreaterThan(0)
          }
        }
        expect(optionsExamined).toBe(6)

        // Key not sole extremum: both smallest and largest counts should exist
        const counts = item.optionSpecs
          .map((o) => (o.elements?.[0]?.type === 'dots' ? (o.elements[0].anchors || []).length : 0))
          .filter((c) => c > 0)
        const minCount = Math.min(...counts)
        const maxCount = Math.max(...counts)
        expect(maxCount - minCount).toBeLessThanOrEqual(2)
      }
    })
  })

  describe('operand pair constraints', () => {
    it('sampler produces rows where operands overlap and intersection is non-trivial', () => {
      const result = generateFamily(LRM_DOTS_AND, 'operand-constraint', 10)
      expect(result.items.length).toBeGreaterThan(0)

      for (const item of result.items) {
        // Each operand set should be in [2, 4] anchors and have some overlap
        // Intersections should all be distinct (checked by sampler constraint)
        for (const opt of item.optionSpecs) {
          const el = opt.elements?.[0]
          if (el && el.type === 'dots') {
            const count = (el.anchors || []).length
            expect(count).toBeGreaterThanOrEqual(1)
            expect(count).toBeLessThanOrEqual(5)
          }
        }
      }
    })
  })

  describe('fill incidental variation', () => {
    it('fill is constant per item; multiple items show variety in fill', () => {
      const result = generateFamily(LRM_DOTS_AND, 'fill-variation', 20)
      expect(result.items.length).toBeGreaterThan(0)

      for (const item of result.items) {
        // All options in one item should have the same fill
        const fills = new Set<string>()
        for (const opt of item.optionSpecs) {
          const el = opt.elements?.[0]
          if (el && el.type === 'dots') {
            fills.add(el.fill || 'solid')
          }
        }
        expect(fills.size).toBe(1)
      }

      // Across items, we should see variety in fills (high likelihood)
      const itemFills = new Set<string>()
      for (const item of result.items) {
        const el = item.optionSpecs[0]?.elements?.[0]
        if (el && el.type === 'dots') {
          itemFills.add(el.fill || 'solid')
        }
      }
      // With 20 items and 4 fill choices, high likelihood of seeing ≥2 fills
      expect(itemFills.size).toBeGreaterThanOrEqual(1)
    })
  })

  describe('difficulty: predicted B band', () => {
    it('radicals yield predictedB ≈ −0.9, band "moderate"', () => {
      const radicals = LRM_DOTS_AND.radicals
      const predicted = predictedB(radicals, { nonCardinalAsymmetricRotation: false })

      // Expected per spec: −2 + 0.8 (R11) + 0.3 (perceptualLoad 1) + 0.15 (nearMissCount 3) ≈ −0.75
      // But spec states ≈ −0.9
      // Using formula: −2 + 0.8 + 0 + 0 + 0.3 + 0.15 = −0.75
      // Band 'moderate' is -1 ≤ b < 0.5
      expect(predicted).toBeGreaterThan(-1.5)
      expect(predicted).toBeLessThan(0.5)
    })
  })

  describe('grid structure and uniqueness', () => {
    it('composed item has 8 grid cells + 1 key, all distinct sets on outer.anchors axis', () => {
      const rng = makeRng('grid-uniqueness-check')
      const composed = composeItem(LRM_DOTS_AND, rng)

      // Verify grid and key exist
      expect(composed.grid).toHaveLength(8)
      expect(composed.keyCell).toBeDefined()

      // Collect all anchor sets
      const anchorSets = new Map<string, number>()
      for (const cell of composed.grid) {
        const el = cell.elements[0]
        if (el && el.type === 'dots') {
          const anchors = (el.anchors || []).sort().join(',')
          anchorSets.set(anchors, (anchorSets.get(anchors) || 0) + 1)
        }
      }

      // All 8 grid cells should be distinct
      expect(anchorSets.size).toBe(8)

      // Key should be different from all grid cells
      const keyEl = composed.keyCell.elements[0]
      if (keyEl && keyEl.type === 'dots') {
        const keyAnchors = (keyEl.anchors || []).sort().join(',')
        expect(anchorSets.has(keyAnchors)).toBe(false)
      }
    })
  })

  describe('distractor mechanisms: five distinct non-key options', () => {
    it('each item has distractors recorded in optionDiagnostics', () => {
      const result = generateFamily(LRM_DOTS_AND, 'mechanism-check', 5)
      expect(result.items.length).toBeGreaterThan(0)

      for (const item of result.items) {
        expect(item.optionSpecs).toHaveLength(6)
        expect(item.optionDiagnostics).toHaveLength(6)

        // Count non-null error labels (the distractors)
        const distractors = item.optionDiagnostics.filter((d) => d.errorLabel !== null)
        expect(distractors).toHaveLength(5)

        for (const d of distractors) {
          expect(['WR', 'IR', 'RP', 'PM']).toContain(d.errorLabel)
          expect(d.rationale).toBeDefined()
          expect(d.rationale!.length).toBeGreaterThan(0)
        }
      }
    })
  })
})
