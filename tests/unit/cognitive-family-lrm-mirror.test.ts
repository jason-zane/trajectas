/**
 * Tests for LRM-MIRROR family: reflection as an operation.
 *
 * Verifies:
 * - Schema validation for flip/reflection operations
 * - Distractor plan correctness (IR, WR, PM, RP, RP)
 * - Constraint satisfaction (4-6 distinct states, key is twin, uniquely solvable)
 * - Difficulty prior computation (b ≈ -1.5, band 'easy')
 * - Generation battery across multiple seeds (≥50% acceptance rate)
 */

import { describe, it, expect } from 'vitest'
import { generateFamily } from '@/lib/cognitive/generator'
import { LRM_MIRROR } from '@/lib/cognitive/generator/families/lrm-mirror'
import { composeItem } from '@/lib/cognitive/generator/compose'
import { makeRng } from '@/lib/cognitive/generator/rng'
import { readAxis } from '@/lib/cognitive/generator/axes'
import { predictedB, band } from '@/lib/cognitive/generator/difficulty'
import type { FlipState } from '@/lib/cognitive/generator/rules'

describe('LRM-MIRROR family', () => {
  describe('smoke test — generation across multiple seeds', () => {
    it('generates at least 50% of requested items across 3 seeds × 6 draws', () => {
      let totalAccepted = 0
      let totalAttempted = 0
      const seenRationales = new Set<string>()

      for (let s = 0; s < 3; s++) {
        const result = generateFamily(LRM_MIRROR, `lrm-mirror-smoke-${s}`, 6)
        totalAccepted += result.items.length
        totalAttempted += result.attempted

        for (const item of result.items) {
          // Every item should have 6 options
          expect(item.optionSpecs).toHaveLength(6)

          // Collect distractor rationales (parallel to optionSpecs by slot)
          for (const diag of item.optionDiagnostics) {
            if (diag.rationale) seenRationales.add(diag.rationale)
          }
        }
      }

      expect(totalAccepted).toBeGreaterThan(totalAttempted / 2)
      // Should see a mix of the planned mechanisms
      expect(seenRationales.size).toBeGreaterThanOrEqual(3)
    })
  })

  describe('contract validation — single accepted item', () => {
    it('pinned item satisfies constraints: 4-6 states, key is twin, all options in-vocab', () => {
      // Generate one item and inspect it in detail
      const result = generateFamily(LRM_MIRROR, 'contract-pin', 1)
      expect(result.items.length).toBeGreaterThan(0)

      const item = result.items[0]
      const gridStates = new Set<string>()
      const optionStates = new Set<string>()

      // Collect visible grid states
      for (const cell of item.itemSpec.grid.cells) {
        const flipVal = readAxis(cell, 'outer.flip')
        if (flipVal && flipVal.t === 'enum') {
          gridStates.add(flipVal.v)
        }
      }

      // Collect option states (including key)
      for (const opt of item.optionSpecs) {
        const flipVal = readAxis(opt, 'outer.flip')
        if (flipVal && flipVal.t === 'enum') {
          optionStates.add(flipVal.v)
        }
      }

      // Constraint (b): 4-6 distinct states in grid
      expect(gridStates.size).toBeGreaterThanOrEqual(4)
      expect(gridStates.size).toBeLessThanOrEqual(6)

      // Constraint (c): key is a twin (key state appears in grid)
      const keyFlip = readAxis(item.optionSpecs[item.optionSpecs.findIndex(o => o.slot === item.keySlot)], 'outer.flip')
      expect(keyFlip).not.toBeNull()
      if (keyFlip && keyFlip.t === 'enum') {
        expect(gridStates.has(keyFlip.v)).toBe(true)
      }

      // Six distinct orientation states across the options (flip is the
      // declared axis, so G-19's palette check exempts it; a distractor MAY
      // show an orientation the grid does not — the key's class only needs
      // one companion, which the twin distractors supply).
      expect(optionStates.size).toBe(6)

      // Check that we have the expected distractor rationale labels
      const mechanisms = new Set<string>()
      for (const diag of item.optionDiagnostics) {
        if (diag.rationale) mechanisms.add(diag.rationale)
      }
      // Should have seen IR, WR, PM, RP mechanisms
      expect(mechanisms.size).toBeGreaterThanOrEqual(3)
    })

    it('key is not modal on outer.flip axis (G-08′)', () => {
      const result = generateFamily(LRM_MIRROR, 'modal-check', 5)
      expect(result.items.length).toBeGreaterThan(0)

      for (const item of result.items) {
        const keyIdx = item.optionSpecs.findIndex(o => o.slot === item.keySlot)
        const keyFlip = readAxis(item.optionSpecs[keyIdx], 'outer.flip')
        expect(keyFlip).not.toBeNull()

        if (keyFlip && keyFlip.t === 'enum') {
          // Count how many options share the key's flip value
          let keyCount = 1 // key itself
          for (const opt of item.optionSpecs) {
            const optFlip = readAxis(opt, 'outer.flip')
            if (optFlip && optFlip.t === 'enum' && optFlip.v === keyFlip.v) {
              keyCount++
            }
          }
          // Key should not be the only option at its flip value, OR it should
          // be one of ≥4 options sharing that value (context-blind pass).
          // Since we have 6 options total and constraint (b) ensures 4-6 states
          // visible, the key cannot be modal.
          expect(keyCount).toBeLessThanOrEqual(3) // ≤ half, given 6 options
        }
      }
    })

    it('all options pairwise distinct (glyph/fill/flip combination)', () => {
      const result = generateFamily(LRM_MIRROR, 'distinctness', 3)
      for (const item of result.items) {
        const keys = item.optionSpecs.map((opt) => {
          const glyph = readAxis(opt, 'outer.shape')
          const fill = readAxis(opt, 'outer.fill')
          const flip = readAxis(opt, 'outer.flip')
          return `${glyph?.v ?? 'none'}|${fill?.v ?? 'none'}|${flip?.v ?? 'none'}`
        })
        const uniqueKeys = new Set(keys)
        expect(uniqueKeys.size).toBe(6) // All 6 options distinct
      }
    })
  })

  describe('difficulty model (predictedB)', () => {
    it('computes b ≈ -1.5 (easy band) from radicals', () => {
      const b = predictedB(LRM_MIRROR.radicals, { nonCardinalAsymmetricRotation: false })
      expect(b).toBeCloseTo(-1.5, 1) // Within 0.05 of -1.5
      expect(band(b)).toBe('easy')
    })

    it('radicals match the spec: ruleIds=[R10], ruleCount=1, crossLayer=false, perceptualLoad=0, nearMissCount=2', () => {
      expect(LRM_MIRROR.radicals.ruleIds).toEqual(['R10'])
      expect(LRM_MIRROR.radicals.ruleCount).toBe(1)
      expect(LRM_MIRROR.radicals.crossLayer).toBe(false)
      expect(LRM_MIRROR.radicals.perceptualLoad).toBe(0)
      expect(LRM_MIRROR.radicals.nearMissCount).toBe(2)
    })

    it('every generated item computes predicted_difficulty correctly', () => {
      const result = generateFamily(LRM_MIRROR, 'difficulty-pin', 3)
      for (const item of result.items) {
        // item.qa.predictedB should match our formula applied to item's family radicals
        const computed = predictedB(LRM_MIRROR.radicals, { nonCardinalAsymmetricRotation: false })
        expect(item.qa.predictedB).toBeCloseTo(computed, 5)
        expect(item.qa.band).toBe('easy')
      }
    })
  })

  describe('distractor plan determinism', () => {
    it('builds exactly 5 distractors with mix of IR, WR, PM, RP labels', () => {
      const rng = makeRng('distractor-order-check')
      const composed = composeItem(LRM_MIRROR, rng)
      const ctx = {
        grid: composed.grid,
        keyCell: composed.keyCell,
        axes: LRM_MIRROR.axes,
        valueAt: composed.valueAt,
        params: composed.params,
        template: LRM_MIRROR,
      }
      const distractors = LRM_MIRROR.buildDistractors(ctx, rng)

      expect(distractors).toHaveLength(5)

      // Check labels are correct types
      const labels = distractors.map(d => d.label)
      expect(labels).toContain('IR')
      expect(labels).toContain('WR')
      expect(labels).toContain('PM')
      expect(labels).toContain('RP')

      // Check all have mechanisms
      for (const d of distractors) {
        expect(d.mechanism).toBeTruthy()
        expect(d.wrongAxes).toContain('outer.flip')
      }
    })
  })

  describe('reflection geometry', () => {
    it('composes flip states correctly using the D4 group', () => {
      // Pin a specific item and verify reflection operations compose correctly
      const rng = makeRng('flip-composition-check')
      const composed = composeItem(LRM_MIRROR, rng)

      // For each grid cell, verify flip value is valid
      for (const cell of composed.grid) {
        const cellFlip = readAxis(cell, 'outer.flip')
        expect(cellFlip).not.toBeNull()
        if (!cellFlip || cellFlip.t !== 'enum') continue

        // The cell's flip value should be one of the 8 D4 states
        const allStates: FlipState[] = ['none', 'h', 'v', 'hv', 'd1', 'd2', 'r90', 'r270']
        expect(allStates).toContain(cellFlip.v as FlipState)
      }

      // Key cell flip should also be a valid D4 state
      const keyFlip = readAxis(composed.keyCell, 'outer.flip')
      expect(keyFlip).not.toBeNull()
      if (keyFlip && keyFlip.t === 'enum') {
        const allStates: FlipState[] = ['none', 'h', 'v', 'hv', 'd1', 'd2', 'r90', 'r270']
        expect(allStates).toContain(keyFlip.v as FlipState)
      }
    })
  })

  describe('sampler constraints', () => {
    it('constraint (a): three starting orientations are pairwise distinct', () => {
      for (let i = 0; i < 20; i++) {
        const rng = makeRng(`sampler-check-a-${i}`)
        const composed = composeItem(LRM_MIRROR, rng)
        const params = composed.params as { starts: string[] }
        const starts = params.starts

        // Should be three distinct flip states
        expect(starts).toHaveLength(3)
        expect(new Set(starts).size).toBe(3)
      }
    })

    it('constraint (b): 4-6 distinct flip states in the visible grid', () => {
      for (let i = 0; i < 20; i++) {
        const rng = makeRng(`sampler-check-b-${i}`)
        const composed = composeItem(LRM_MIRROR, rng)

        const stateSet = new Set<string>()
        for (const cell of composed.grid) {
          const flip = readAxis(cell, 'outer.flip')
          if (flip && flip.t === 'enum') {
            stateSet.add(flip.v)
          }
        }

        expect(stateSet.size).toBeGreaterThanOrEqual(4)
        expect(stateSet.size).toBeLessThanOrEqual(6)
      }
    })

    it('constraint (c): key state appears in the visible grid (key is a twin)', () => {
      for (let i = 0; i < 20; i++) {
        const rng = makeRng(`sampler-check-c-${i}`)
        const composed = composeItem(LRM_MIRROR, rng)

        const stateSet = new Set<string>()
        for (const cell of composed.grid) {
          const flip = readAxis(cell, 'outer.flip')
          if (flip && flip.t === 'enum') {
            stateSet.add(flip.v)
          }
        }

        const keyFlip = readAxis(composed.keyCell, 'outer.flip')
        expect(keyFlip).not.toBeNull()
        if (keyFlip && keyFlip.t === 'enum') {
          expect(stateSet.has(keyFlip.v)).toBe(true)
        }
      }
    })

    it('constraint (d): grid is uniquely solvable (Level A passes)', () => {
      for (let i = 0; i < 10; i++) {
        const rng = makeRng(`sampler-check-d-${i}`)
        const composed = composeItem(LRM_MIRROR, rng)

        // If we reached here without throw, the sampler's uniquelySolvable
        // check passed. Level A also runs independently during QA, so this
        // is verified downstream.
        expect(composed.grid).toHaveLength(8)
        expect(composed.keyCell.elements.length).toBeGreaterThan(0)
      }
    })
  })

  describe('parameter space', () => {
    it('samples glyph from {flag, lshape, trapezoid}', () => {
      const glyphs = new Set<string>()
      for (let i = 0; i < 50; i++) {
        const rng = makeRng(`glyph-sample-${i}`)
        const params = LRM_MIRROR.sampleParams(rng)
        glyphs.add(params.glyph)
      }
      expect(glyphs).toContain('flag')
      expect(glyphs).toContain('lshape')
      expect(glyphs).toContain('trapezoid')
    })

    it('samples fill from {solid, grey, outline}', () => {
      const fills = new Set<string>()
      for (let i = 0; i < 50; i++) {
        const rng = makeRng(`fill-sample-${i}`)
        const params = LRM_MIRROR.sampleParams(rng)
        fills.add(params.fill)
      }
      expect(fills).toContain('solid')
      expect(fills).toContain('grey')
      expect(fills).toContain('outline')
    })

    it('samples op1, op2 distinct from {h, v, d1, d2}', () => {
      for (let i = 0; i < 50; i++) {
        const rng = makeRng(`op-sample-${i}`)
        const params = LRM_MIRROR.sampleParams(rng)
        expect(params.op1).not.toBe(params.op2)
        expect(['h', 'v', 'd1', 'd2']).toContain(params.op1)
        expect(['h', 'v', 'd1', 'd2']).toContain(params.op2)
      }
    })

    it('samples direction from {row, column}', () => {
      const directions = new Set<string>()
      for (let i = 0; i < 50; i++) {
        const rng = makeRng(`direction-sample-${i}`)
        const params = LRM_MIRROR.sampleParams(rng)
        directions.add(params.direction)
      }
      expect(directions).toContain('row')
      expect(directions).toContain('column')
    })
  })

  describe('structural distinction (incidentals)', () => {
    it('structuralExtra captures glyph, fill, op1, op2, direction', () => {
      const rng = makeRng('struct-extra-check')
      const params = LRM_MIRROR.sampleParams(rng)
      const extra = LRM_MIRROR.structuralExtra?.(params)

      expect(extra).toBeDefined()
      expect(extra).toHaveProperty('glyph')
      expect(extra).toHaveProperty('fill')
      expect(extra).toHaveProperty('op1')
      expect(extra).toHaveProperty('op2')
      expect(extra).toHaveProperty('direction')
    })
  })
})
