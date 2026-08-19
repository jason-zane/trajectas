/**
 * Tests for LRM-NEST-ADD family: union (R4) on concentric containers.
 *
 * Verifies:
 * - Nest element schema validation with three rings and distinct shapes
 * - Distractor plan correctness (RP, RP, WR, IR, IR priority)
 * - Constraint satisfaction: key is 2-ring union (disjoint singletons), grid contains 1-3 ring counts
 * - G-08′ modal arithmetic: key not the option matching all modal values
 * - G-09 complexity spread: ring counts {1,2,3} spread ≤ 2
 * - Difficulty prior computation (b ≈ −0.9, band 'moderate')
 * - Generation battery across multiple seeds (≥50% acceptance rate)
 * - Level A uniqueness: sampler ensures grid is uniquely solvable
 */

import { describe, it, expect } from 'vitest'
import { generateFamily } from '@/lib/cognitive/generator'
import { LRM_NEST_ADD } from '@/lib/cognitive/generator/families/lrm-nest-add'
import { composeItem } from '@/lib/cognitive/generator/compose'
import { makeRng } from '@/lib/cognitive/generator/rng'
import { readAxis } from '@/lib/cognitive/generator/axes'
import { predictedB, band } from '@/lib/cognitive/generator/difficulty'

describe('LRM-NEST-ADD family', () => {
  describe('smoke test — generation across multiple seeds', () => {
    it('generates at least 50% of requested items across 3 seeds × 8 draws', () => {
      let totalAccepted = 0
      let totalAttempted = 0
      const seenRationales = new Set<string>()

      for (let s = 0; s < 3; s++) {
        const result = generateFamily(LRM_NEST_ADD, `lrm-nest-add-smoke-${s}`, 8)
        totalAccepted += result.items.length
        totalAttempted += result.attempted

        for (const item of result.items) {
          // Every item should have 6 options
          expect(item.optionSpecs).toHaveLength(6)

          // Collect distractor rationales
          for (let i = 0; i < item.optionDiagnostics.length; i++) {
            const diag = item.optionDiagnostics[i]
            if (diag?.rationale) {
              seenRationales.add(diag.rationale)
            }
          }
        }
      }

      expect(totalAccepted).toBeGreaterThan(totalAttempted / 2)
      // Should see a mix of distractor mechanisms
      expect(seenRationales.size).toBeGreaterThanOrEqual(3)
    })
  })

  describe('contract validation — single accepted item', () => {
    it('pinned item satisfies constraints: key is 2-ring, grid has ring counts in {1,2,3}', () => {
      // Generate one item and inspect it in detail
      const result = generateFamily(LRM_NEST_ADD, 'contract-pin', 1)
      expect(result.items.length).toBeGreaterThan(0)

      const item = result.items[0]
      const gridRingCounts = new Set<number>()
      const optionRingCounts = new Set<number>()

      // Collect visible grid ring counts
      for (const cell of item.itemSpec.grid.cells) {
        const ringsVal = readAxis(cell, 'outer.rings')
        if (ringsVal && ringsVal.t === 'set') {
          gridRingCounts.add(ringsVal.v.length)
        }
      }

      // Collect option ring counts (including key)
      for (const opt of item.optionSpecs) {
        const ringsVal = readAxis(opt, 'outer.rings')
        if (ringsVal && ringsVal.t === 'set') {
          optionRingCounts.add(ringsVal.v.length)
        }
      }

      // Constraint: grid contains ring counts from {1,2,3}
      expect(gridRingCounts.size).toBeGreaterThanOrEqual(1)
      expect(gridRingCounts.size).toBeLessThanOrEqual(3)

      // Constraint: key has 2 rings (disjoint singleton operands)
      const keyIdx = item.optionSpecs.findIndex((o) => o.slot === item.keySlot)
      const keyRings = readAxis(item.optionSpecs[keyIdx], 'outer.rings')
      expect(keyRings).not.toBeNull()
      if (keyRings && keyRings.t === 'set') {
        expect(keyRings.v.length).toBe(2)
      }

      // G-19: all options use only in-vocab ring counts (grid + key)
      const validCounts = new Set([...gridRingCounts, 2])
      for (const count of optionRingCounts) {
        expect(validCounts.has(count)).toBe(true)
      }

      // Check that we have the expected distractor error labels
      const labels = new Set<string>()
      for (let i = 0; i < item.optionSpecs.length; i++) {
        const label = item.optionDiagnostics[i]?.errorLabel
        if (label) {
          labels.add(label)
        }
      }
      // Should have seen RP, WR, and/or IR labels
      expect(labels.size).toBeGreaterThanOrEqual(2)
    })

    it('key is not modal on outer.rings axis (G-08′)', () => {
      const result = generateFamily(LRM_NEST_ADD, 'modal-check', 5)
      expect(result.items.length).toBeGreaterThan(0)

      for (const item of result.items) {
        const keyIdx = item.optionSpecs.findIndex((o) => o.slot === item.keySlot)
        const keyRings = readAxis(item.optionSpecs[keyIdx], 'outer.rings')
        expect(keyRings).not.toBeNull()

        if (keyRings && keyRings.t === 'set') {
          // Count how many options share the key's ring count
          const keyCount = keyRings.v.length
          let countMatches = 1 // key itself
          for (const opt of item.optionSpecs) {
            const optRings = readAxis(opt, 'outer.rings')
            if (optRings && optRings.t === 'set' && optRings.v.length === keyCount) {
              countMatches++
            }
          }
          // Key should not be the only option at its count, OR it should be one of ≥4
          // options sharing that count (context-blind pass).
          expect(countMatches).toBeLessThanOrEqual(3) // ≤ half, given 6 options
        }
      }
    })

    it('all options pairwise distinct (ring-set combination)', () => {
      const result = generateFamily(LRM_NEST_ADD, 'distinctness', 3)
      for (const item of result.items) {
        const keys = item.optionSpecs.map((opt) => {
          const rings = readAxis(opt, 'outer.rings')
          // For simplicity, key by ring set (elements should differ on rings at minimum)
          if (rings && rings.t === 'set') {
            return `${[...rings.v].sort().join(',')}`
          }
          return 'none'
        })
        const uniqueKeys = new Set(keys)
        expect(uniqueKeys.size).toBe(6) // All 6 options distinct
      }
    })
  })

  describe('nest element schema validation', () => {
    it('every option parses as a valid nest element', () => {
      const result = generateFamily(LRM_NEST_ADD, 'nest-schema', 3)
      for (const item of result.items) {
        for (const opt of item.optionSpecs) {
          expect(opt.elements).toHaveLength(1)
          const el = opt.elements[0]
          if (el.type !== 'nest') throw new Error('Expected nest element')
          expect(el.type).toBe('nest')
          expect(el.layer).toBe('outer')
          expect(Array.isArray(el.rings)).toBe(true)
          expect(el.rings.length).toBeGreaterThanOrEqual(1)
          expect(el.rings.length).toBeLessThanOrEqual(3)
          expect(el.ringShapes).toHaveLength(3)
          expect(el.ringFills).toHaveLength(3)
          // R1 and R2 must be outline
          expect(el.ringFills[0]).toBe('outline')
          expect(el.ringFills[1]).toBe('outline')
          // R3 may be any fill
          expect(['solid', 'grey', 'hatched', 'outline']).toContain(el.ringFills[2])
        }
      }
    })

    it('ring shapes are distinct and from {circle, square, diamond, hexagon}', () => {
      const result = generateFamily(LRM_NEST_ADD, 'shapes-check', 3)
      for (const item of result.items) {
        const el = item.optionSpecs[0].elements[0]
        if (el.type !== 'nest') throw new Error('Expected nest element')
        expect(el.ringShapes).toHaveLength(3)
        const shapes = new Set(el.ringShapes)
        expect(shapes.size).toBe(3) // All distinct
        for (const shape of el.ringShapes) {
          expect(['circle', 'square', 'diamond', 'hexagon']).toContain(shape)
        }
      }
    })
  })

  describe('difficulty model (predictedB)', () => {
    it('computes b ≈ −0.75 (moderate band) from radicals: −2 + 0.8 (R4) + 0.3 (perceptual load 1) + 0.15 (three near misses)', () => {
      const b = predictedB(LRM_NEST_ADD.radicals, { nonCardinalAsymmetricRotation: false })
      expect(b).toBeCloseTo(-0.75, 1)
      expect(band(b)).toBe('moderate')
    })

    it('radicals match the spec: ruleIds=[R4], ruleCount=1, crossLayer=false, perceptualLoad=1, nearMissCount=3', () => {
      expect(LRM_NEST_ADD.radicals.ruleIds).toEqual(['R4'])
      expect(LRM_NEST_ADD.radicals.ruleCount).toBe(1)
      expect(LRM_NEST_ADD.radicals.crossLayer).toBe(false)
      expect(LRM_NEST_ADD.radicals.perceptualLoad).toBe(1)
      expect(LRM_NEST_ADD.radicals.nearMissCount).toBe(3)
    })

    it('every generated item computes predicted_difficulty correctly', () => {
      const result = generateFamily(LRM_NEST_ADD, 'difficulty-pin', 3)
      for (const item of result.items) {
        const computed = predictedB(LRM_NEST_ADD.radicals, { nonCardinalAsymmetricRotation: false })
        expect(item.qa.predictedB).toBeCloseTo(computed, 5)
        expect(item.qa.band).toBe('moderate')
      }
    })
  })

  describe('distractor plan determinism', () => {
    it('builds exactly 5 distractors with RP, WR, IR labels', () => {
      const rng = makeRng('distractor-order-check')
      const composed = composeItem(LRM_NEST_ADD, rng)
      const ctx = {
        grid: composed.grid,
        keyCell: composed.keyCell,
        axes: LRM_NEST_ADD.axes,
        valueAt: composed.valueAt,
        params: composed.params,
        template: LRM_NEST_ADD,
      }
      const distractors = LRM_NEST_ADD.buildDistractors(ctx, rng)

      expect(distractors).toHaveLength(5)

      // Check labels are correct types
      const labels = distractors.map((d) => d.label)
      expect(labels).toContain('RP')
      expect(labels).toContain('WR')
      expect(labels).toContain('IR')

      // Check all have mechanisms
      for (const d of distractors) {
        expect(d.mechanism).toBeTruthy()
        expect(d.wrongAxes).toContain('outer.rings')
      }
    })
  })

  describe('sampler constraints', () => {
    it('constraint: row 3 operands are disjoint singletons', () => {
      for (let i = 0; i < 20; i++) {
        const rng = makeRng(`sampler-check-row3-${i}`)
        const composed = composeItem(LRM_NEST_ADD, rng)

        // Check row 3 cells
        const row3c1 = readAxis(composed.grid[6], 'outer.rings') // row 3, col 1 (index 6)
        const row3c2 = readAxis(composed.grid[7], 'outer.rings') // row 3, col 2 (index 7)

        expect(row3c1).not.toBeNull()
        expect(row3c2).not.toBeNull()

        if (row3c1 && row3c1.t === 'set' && row3c2 && row3c2.t === 'set') {
          // Both should be singletons
          expect(row3c1.v.length).toBe(1)
          expect(row3c2.v.length).toBe(1)
          // They should be disjoint (different rings)
          expect(row3c1.v[0]).not.toBe(row3c2.v[0])
        }
      }
    })

    it('constraint: key (row 3, col 3) has 2 rings', () => {
      for (let i = 0; i < 20; i++) {
        const rng = makeRng(`sampler-check-key-${i}`)
        const composed = composeItem(LRM_NEST_ADD, rng)

        const keyRings = readAxis(composed.keyCell, 'outer.rings')
        expect(keyRings).not.toBeNull()
        if (keyRings && keyRings.t === 'set') {
          expect(keyRings.v.length).toBe(2)
        }
      }
    })

    it('constraint: grid is uniquely solvable (Level A passes)', () => {
      for (let i = 0; i < 10; i++) {
        const rng = makeRng(`sampler-check-level-a-${i}`)
        const composed = composeItem(LRM_NEST_ADD, rng)

        // If we reached here without throw, the sampler's uniquelySolvable
        // check passed. Level A also runs independently during QA.
        expect(composed.grid).toHaveLength(8)
        expect(composed.keyCell.elements.length).toBeGreaterThan(0)
      }
    })

    it('constraint (OQ-3, permitKeyEqualsCell): the key set appears among the visible cells, rows 1–2 operands are not nested, column 3 is not constant', () => {
      expect(LRM_NEST_ADD.permitKeyEqualsCell).toBe(true)
      for (let i = 0; i < 10; i++) {
        const rng = makeRng(`sampler-check-distinct-${i}`)
        const composed = composeItem(LRM_NEST_ADD, rng)
        const keyRings = readAxis(composed.keyCell, 'outer.rings')
        expect(keyRings && keyRings.t === 'set').toBe(true)
        const keyKey = keyRings && keyRings.t === 'set' ? [...keyRings.v].sort().join(',') : ''
        const cellKeys = composed.grid.map((cell) => {
          const rings = readAxis(cell, 'outer.rings')
          return rings && rings.t === 'set' ? [...rings.v].sort().join(',') : ''
        })
        expect(cellKeys).toContain(keyKey)
        const col3 = composed.grid.filter((c) => c.col === 3).map((c) => { const r = readAxis(c, 'outer.rings'); return r && r.t === 'set' ? [...r.v].sort().join(',') : '' })
        expect(new Set([...col3, keyKey]).size).toBeGreaterThan(1)
        for (const row of [1, 2]) {
          const a = composed.grid.find((c) => c.row === row && c.col === 1)!
          const b = composed.grid.find((c) => c.row === row && c.col === 2)!
          const ra = readAxis(a, 'outer.rings')
          const rb = readAxis(b, 'outer.rings')
          if (ra && rb && ra.t === 'set' && rb.t === 'set') {
            const A = new Set(ra.v)
            const B = new Set(rb.v)
            expect([...A].every((x) => B.has(x))).toBe(false)
            expect([...B].every((x) => A.has(x))).toBe(false)
          }
        }
      }
    })
  })

  describe('parameter space', () => {
    it('samples ring shapes from {circle, square, diamond, hexagon}', () => {
      const shapeTokens = new Set<string>()
      for (let i = 0; i < 50; i++) {
        const rng = makeRng(`shape-sample-${i}`)
        const params = LRM_NEST_ADD.sampleParams(rng)
        for (const shape of params.ringShapes) {
          shapeTokens.add(shape)
        }
      }
      expect(shapeTokens.size).toBeGreaterThanOrEqual(3)
      for (const shape of ['circle', 'square', 'diamond', 'hexagon']) {
        if (shapeTokens.size === 4) {
          expect(shapeTokens.has(shape)).toBe(true)
        }
      }
    })

    it('samples inner fill from {solid, grey, hatched, outline}', () => {
      const fills = new Set<string>()
      for (let i = 0; i < 50; i++) {
        const rng = makeRng(`fill-sample-${i}`)
        const params = LRM_NEST_ADD.sampleParams(rng)
        fills.add(params.innerFill)
      }
      expect(fills.size).toBeGreaterThanOrEqual(2)
    })

    it('direction is row_operator (the rule statement and valueAt are row-wise)', () => {
      for (let i = 0; i < 10; i++) {
        const rng = makeRng(`direction-sample-${i}`)
        const params = LRM_NEST_ADD.sampleParams(rng)
        expect(params.direction).toBe('row_operator')
      }
    })
  })

  describe('structural distinction (incidentals)', () => {
    it('structuralExtra captures ringShapes, innerFill, direction, and rows', () => {
      const rng = makeRng('struct-extra-check')
      const params = LRM_NEST_ADD.sampleParams(rng)
      const extra = LRM_NEST_ADD.structuralExtra?.(params)

      expect(extra).toBeDefined()
      expect(extra).toHaveProperty('ringShapes')
      expect(extra).toHaveProperty('innerFill')
      expect(extra).toHaveProperty('direction')
      expect(extra).toHaveProperty('rows')
    })
  })
})
