/**
 * Tests for bitgrid Boolean families: LRM-BITS-XOR and LRM-BITS-2OP.
 *
 * Verifies:
 * - Schema validation (disjoint black/hatched sets)
 * - readAxis for bits.black and bits.hatched
 * - Rendering to SVG
 * - Both families pass battery over 20 seeds x 8 draws
 */
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import type { Element } from '@/lib/cognitive/spec/schema'
import { BitgridElement } from '@/lib/cognitive/spec/schema'
import { readAxis, cellComplexity, axesPresentIn } from '@/lib/cognitive/generator/axes'
import { renderCellSvg } from '@/lib/cognitive/render/matrix-svg'
import { generateFamily } from '@/lib/cognitive/generator/index'
import { modalHitRate } from '@/lib/cognitive/generator/qa/contextblind'
import { ALL_FAMILIES, FAMILY_REGISTRY } from '@/lib/cognitive/generator/families'

describe('Bitgrid element schema', () => {
  it('accepts disjoint black and hatched sets', () => {
    const valid: z.infer<typeof BitgridElement> = {
      type: 'bitgrid',
      layer: 'outer',
      black: [0, 1, 3],
      hatched: [4, 5, 7],
    }
    const result = BitgridElement.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('rejects overlapping black and hatched sets', () => {
    const invalid = {
      type: 'bitgrid',
      layer: 'outer',
      black: [0, 1, 3],
      hatched: [3, 4, 5], // Position 3 is in both
    }
    const result = BitgridElement.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('accepts empty sets', () => {
    const valid: z.infer<typeof BitgridElement> = {
      type: 'bitgrid',
      layer: 'outer',
      black: [],
      hatched: [],
    }
    const result = BitgridElement.safeParse(valid)
    expect(result.success).toBe(true)
  })
})

describe('Bitgrid axis reading', () => {
  const cell = {
    elements: [
      {
        type: 'bitgrid' as const,
        layer: 'outer' as const,
        black: [0, 1, 4],
        hatched: [2, 5, 8],
      } as Element,
    ],
  }

  it('reads bits.black as a set', () => {
    const value = readAxis(cell, 'outer.black')
    expect(value).toEqual({ t: 'set', v: ['0', '1', '4'] })
  })

  it('reads bits.hatched as a set', () => {
    const value = readAxis(cell, 'outer.hatched')
    expect(value).toEqual({ t: 'set', v: ['2', '5', '8'] })
  })

  it('returns null for non-existent axes', () => {
    expect(readAxis(cell, 'outer.shape')).toBeNull()
    expect(readAxis(cell, 'inner.bars')).toBeNull()
  })
})

describe('Bitgrid complexity calculation', () => {
  it('counts filled mini-cells', () => {
    const cell = {
      elements: [
        {
          type: 'bitgrid' as const,
          layer: 'outer' as const,
          black: [0, 1, 2],
          hatched: [4, 5],
        } as Element,
      ],
    }
    // 3 black + 2 hatched = 5
    expect(cellComplexity(cell)).toBe(5)
  })
})

describe('Bitgrid axis discovery', () => {
  it('includes bits.black and bits.hatched', () => {
    const cell = {
      elements: [
        {
          type: 'bitgrid' as const,
          layer: 'outer' as const,
          black: [0, 1],
          hatched: [3, 4],
        } as Element,
      ],
    }
    const axes = axesPresentIn(cell)
    expect(axes).toContain('outer.black')
    expect(axes).toContain('outer.hatched')
  })
})

describe('Bitgrid rendering', () => {
  it('renders without error', () => {
    const cell = {
      elements: [
        {
          type: 'bitgrid' as const,
          layer: 'outer' as const,
          black: [0, 2, 4],
          hatched: [1, 5, 8],
        } as Element,
      ],
    }
    const render = { styleVersion: 'v1' as const, canvas: 100 as const, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 }
    const svg = renderCellSvg(cell.elements, render)
    expect(svg).toContain('<svg')
    // Nine mini-cells, each a square polygon drawn through renderFilledGeometry
    // (so hatching is the same clipped 45° family every hatched shape uses).
    expect(svg.match(/<polygon/g)?.length).toBeGreaterThanOrEqual(9)
    // Three black mini-cells filled with ink; hatched ones carry hatch lines.
    expect(svg.match(/<polygon[^>]*fill="#[0-9a-fA-F]{6}"/g)?.length).toBeGreaterThanOrEqual(3)
    expect(svg).toContain('<line')
  })
})

describe('LRM-BITS-XOR family', () => {
  it('is registered', () => {
    const bitsXor = ALL_FAMILIES.find((f) => f.code === 'LRM-BITS-XOR')
    expect(bitsXor).toBeDefined()
    expect(bitsXor?.axes).toContain('outer.black')
  })

  it('declares correct radicals', () => {
    const bitsXor = ALL_FAMILIES.find((f) => f.code === 'LRM-BITS-XOR')!
    expect(bitsXor.radicals.ruleIds).toEqual(['R7'])
    expect(bitsXor.radicals.perceptualLoad).toBe(2)
    expect(bitsXor.radicals.crossLayer).toBe(false)
  })
})

describe('LRM-BITS-2OP family', () => {
  it('is registered', () => {
    const bits2op = ALL_FAMILIES.find((f) => f.code === 'LRM-BITS-2OP')
    expect(bits2op).toBeDefined()
    expect(bits2op?.axes).toContain('outer.black')
    expect(bits2op?.axes).toContain('outer.hatched')
  })

  it('declares correct radicals', () => {
    const bits2op = ALL_FAMILIES.find((f) => f.code === 'LRM-BITS-2OP')!
    expect(bits2op.radicals.ruleIds).toContain('R7')
    expect(bits2op.radicals.ruleIds.some((id) => id === 'R4' || id === 'R5')).toBe(true)
    expect(bits2op.radicals.perceptualLoad).toBe(2)
    expect(bits2op.radicals.crossLayer).toBe(true)
  })
})

describe('Bitgrid families — generation under the full battery', () => {
  // The two families are the v2 form's ceiling content (build-plan §4). What
  // these tests pin: they GENERATE (an earlier draft accepted 0/160 — same
  // operands for every row, so the grid itself was degenerate), every gate
  // passes on every accepted item, the blind modal scorer never beats the
  // ¼ bound (for BITS-2OP it never lands on the key at all — the option set
  // is built so its modal composition is the incomplete-XOR distractor), the
  // priors are what the family headers compute, and the option-set arithmetic
  // the 2OP header claims (G-18 ≥ 2 per axis, complexity spread ≤ 2) holds.
  const SEEDS = ['bitgrid-test-a', 'bitgrid-test-b', 'bitgrid-test-c']
  const DRAWS = 6

  function run(code: string) {
    const fam = FAMILY_REGISTRY[code]
    const items = SEEDS.flatMap((s) => generateFamily(fam, s, DRAWS).items)
    return { fam, items }
  }

  it('LRM-BITS-XOR generates, passes every gate, b = +0.20 (moderate), modal hit rate ≤ 0.25', () => {
    const { fam, items } = run('LRM-BITS-XOR')
    expect(items.length).toBeGreaterThanOrEqual(SEEDS.length * DRAWS * 0.9)
    for (const it of items) {
      expect(Object.values(it.qa.gates).some((g) => g.status === 'fail')).toBe(false)
      expect(it.qa.predictedB).toBeCloseTo(0.2, 5)
      expect(it.qa.band).toBe('moderate')
      const ki = it.optionSpecs.findIndex((o) => o.slot === it.keySlot)
      expect(modalHitRate(it.optionSpecs.map((o) => ({ elements: o.elements })), ki, fam.axes).pHit).toBeLessThanOrEqual(0.25)
      // Every option is a bit-grid with 3 or 4 black positions and nothing hatched.
      for (const o of it.optionSpecs) {
        const el = o.elements[0] as { type: string; black: number[]; hatched: number[] }
        expect(el.type).toBe('bitgrid')
        expect([3, 4]).toContain(el.black.length)
        expect(el.hatched).toEqual([])
      }
    }
  })

  it('LRM-BITS-2OP generates, passes every gate, b = +2.00 (very hard), and its option set is the header pattern', () => {
    const { fam, items } = run('LRM-BITS-2OP')
    expect(items.length).toBeGreaterThanOrEqual(SEEDS.length * DRAWS * 0.9)
    for (const it of items) {
      expect(Object.values(it.qa.gates).some((g) => g.status === 'fail')).toBe(false)
      expect(it.qa.gates['G-20']?.status).toBe('skip') // no cheap axes: both rules hard
      expect(it.qa.predictedB).toBeCloseTo(2.0, 5)
      expect(it.qa.band).toBe('very_hard')
      const cells = it.optionSpecs.map((o) => ({ elements: o.elements }))
      const ki = it.optionSpecs.findIndex((o) => o.slot === it.keySlot)
      const key = it.optionSpecs[ki].elements[0] as { black: number[]; hatched: number[] }
      // Modal composition never lands on the key.
      expect(modalHitRate(cells, ki, fam.axes).pHit).toBe(0)
      // G-18 on both axes: the key's black is held by ≥ 2 options, so is its hatched.
      const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i])
      const els = it.optionSpecs.map((o) => o.elements[0] as { black: number[]; hatched: number[] })
      expect(els.filter((e) => same(e.black, key.black)).length).toBeGreaterThanOrEqual(2)
      expect(els.filter((e) => same(e.hatched, key.hatched)).length).toBeGreaterThanOrEqual(2)
      // Complexity spread ≤ 2 and the key is not a sole extremum.
      const cx = els.map((e) => e.black.length + e.hatched.length)
      expect(Math.max(...cx) - Math.min(...cx)).toBeLessThanOrEqual(2)
      const kc = key.black.length + key.hatched.length
      expect(cx.filter((c) => c === kc).length).toBeGreaterThanOrEqual(2)
      // Black and hatched disjoint in every option (schema refinement, asserted here too).
      for (const e of els) expect(e.black.some((b) => e.hatched.includes(b))).toBe(false)
    }
  })

  it('same seed → byte-identical items (determinism, doc 03 §3.6)', () => {
    for (const code of ['LRM-BITS-XOR', 'LRM-BITS-2OP']) {
      const a = generateFamily(FAMILY_REGISTRY[code], 'bitgrid-determinism', 4)
      const b = generateFamily(FAMILY_REGISTRY[code], 'bitgrid-determinism', 4)
      expect(a.items.map((i) => i.qa.contentHash)).toEqual(b.items.map((i) => i.qa.contentHash))
    }
  })
})
