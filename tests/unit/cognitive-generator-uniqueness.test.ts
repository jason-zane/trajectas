import { describe, it, expect } from 'vitest'
import type { GridCell } from '@/lib/cognitive/spec/schema'
import { levelA, levelB, detectAllAxes } from '@/lib/cognitive/generator/qa/uniqueness'
import type { AxisDomain } from '@/lib/cognitive/generator/rules'
import { LRM_PROG_COUNT } from '@/lib/cognitive/generator/families/lrm-prog-count'
import { LRM_2R_XLAYER } from '@/lib/cognitive/generator/families/lrm-2r-xlayer'
import { composeItem } from '@/lib/cognitive/generator/compose'
import { makeRng } from '@/lib/cognitive/generator/rng'

const AXIS = 'outer.count'
const repeatCell = (row: number, col: number, count: number): GridCell => ({
  row,
  col,
  elements: [{ type: 'repeat', layer: 'outer', shape: 'circle', fill: 'solid', size: 'S', count, rotation: 0 }],
})

describe('qa/uniqueness — Level A/B', () => {
  it('CATCHES A DELIBERATELY AMBIGUOUS ITEM: two rival readings imply different values at (3,3)', () => {
    // Two of Level A's own accidental-regularity probes (rules.ts) both
    // "explain" this grid but disagree on what belongs at (3,3):
    //   - main-diagonal constancy: (1,1)=9, (2,2)=9 -> implies (3,3)=9.
    //   - row alternation (col1 == col3 within a row): row 1 is 9..9,
    //     row 2 is 7..7 -> implies (3,3) = (3,1) = 5.
    // A candidate could defensibly read this grid either way — 9 or 5 —
    // which is precisely the "two defensible answers" failure mode doc
    // 03-item-generation-pipeline.md §5.1 says Level A exists to catch.
    const ambiguousGrid: GridCell[] = [
      repeatCell(1, 1, 9),
      repeatCell(1, 2, 2),
      repeatCell(1, 3, 9), // row 1 alternation: col1 == col3 == 9
      repeatCell(2, 1, 7),
      repeatCell(2, 2, 9), // main diagonal: (1,1) == (2,2) == 9
      repeatCell(2, 3, 7), // row 2 alternation: col1 == col3 == 7
      repeatCell(3, 1, 5),
      repeatCell(3, 2, 3),
    ]
    const domains: Partial<Record<string, AxisDomain>> = { [AXIS]: { kind: 'numeric-linear' } }
    const result = levelA(ambiguousGrid, [AXIS], domains)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('AXIS_AMBIGUOUS')
      // Both rival readings should be visible in the failure detail — this
      // is the audit trail a human reviewer would be shown.
      const readings = (result.detail.readings as Array<{ implies: string }>).map((r) => r.implies)
      expect(readings).toContain('num:9')
      expect(readings).toContain('num:5')
    }
  })

  it('a genuinely unique grid (LRM-PROG-COUNT, doc M1 structure) passes Level A with a SINGLE admissible tuple', () => {
    const rng = makeRng('uniqueness-test-seed')
    const composed = composeItem(LRM_PROG_COUNT, rng)
    const axes = [...new Set([...LRM_PROG_COUNT.axes, ...detectAllAxes(composed.grid)])]
    const result = levelA(composed.grid, axes, composed.domains)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.admissibleTuples).toHaveLength(1)
      // The implied key content must match what the generator itself built at (3,3).
      const impliedCount = result.impliedByAxis[AXIS]
      const actualKeyCount = composed.valueAt(AXIS, 3, 3)
      expect(impliedCount).toEqual(actualKeyCount)
    }
  })

  it('Level B rejects an option set where the key is not uniquely realised (two options both satisfy the rule)', () => {
    const grid: GridCell[] = [repeatCell(1, 1, 1), repeatCell(1, 2, 2), repeatCell(1, 3, 3), repeatCell(2, 1, 2), repeatCell(2, 2, 3), repeatCell(2, 3, 4), repeatCell(3, 1, 3), repeatCell(3, 2, 4)]
    const domains: Partial<Record<string, AxisDomain>> = { [AXIS]: { kind: 'numeric-linear' } }
    const la = levelA(grid, [AXIS], domains)
    expect(la.ok).toBe(true)
    if (!la.ok) return
    const options = [
      { elements: [{ type: 'repeat' as const, layer: 'outer' as const, shape: 'circle' as const, fill: 'solid' as const, size: 'S' as const, count: 5, rotation: 0 }] }, // the true key
      { elements: [{ type: 'repeat' as const, layer: 'outer' as const, shape: 'circle' as const, fill: 'solid' as const, size: 'S' as const, count: 5, rotation: 0 }] }, // duplicate of the key
      { elements: [{ type: 'repeat' as const, layer: 'outer' as const, shape: 'circle' as const, fill: 'solid' as const, size: 'S' as const, count: 1, rotation: 0 }] },
      { elements: [{ type: 'repeat' as const, layer: 'outer' as const, shape: 'circle' as const, fill: 'solid' as const, size: 'S' as const, count: 2, rotation: 0 }] },
      { elements: [{ type: 'repeat' as const, layer: 'outer' as const, shape: 'circle' as const, fill: 'solid' as const, size: 'S' as const, count: 3, rotation: 0 }] },
    ]
    const lb = levelB(options, la)
    expect(lb.ok).toBe(false)
    if (!lb.ok) expect(lb.reason).toBe('KEY_NOT_UNIQUE_AMONG_OPTIONS')
  })

  it('reproduces doc 03-logical-reasoning-design.md §6 M6 exactly (CORRECTED table, issue #346 — 45deg tick step, duplicate-free): outer.shape Latin square + inner.rotation both admit a single reading implying the documented key (circle, tick 0deg)', () => {
    // Hand-encode doc's own CURRENT M6 grid verbatim (not via the
    // generator — this is the independent check that Level A agrees with
    // doc's own worked rationale, byte for byte). Doc's ORIGINAL table
    // (90deg tick step) contained a genuine triple duplicate — see the
    // "Correction" note under doc 03-logical-reasoning-design.md §6 M6 —
    // so this now encodes the corrected 45deg-step table, which keeps the
    // SAME key doc always stated (circle, tick pointing up).
    const grid: GridCell[] = [
      { row: 1, col: 1, elements: [{ type: 'shape', layer: 'outer', shape: 'square', fill: 'outline', size: 'L', anchor: 'CTR', rotation: 0 }, { type: 'tick', layer: 'inner', length: 30, rotation: 0 }] },
      { row: 1, col: 2, elements: [{ type: 'shape', layer: 'outer', shape: 'circle', fill: 'outline', size: 'L', anchor: 'CTR', rotation: 0 }, { type: 'tick', layer: 'inner', length: 30, rotation: 45 }] },
      { row: 1, col: 3, elements: [{ type: 'shape', layer: 'outer', shape: 'diamond', fill: 'outline', size: 'L', anchor: 'CTR', rotation: 0 }, { type: 'tick', layer: 'inner', length: 30, rotation: 90 }] },
      { row: 2, col: 1, elements: [{ type: 'shape', layer: 'outer', shape: 'circle', fill: 'outline', size: 'L', anchor: 'CTR', rotation: 0 }, { type: 'tick', layer: 'inner', length: 30, rotation: 315 }] },
      { row: 2, col: 2, elements: [{ type: 'shape', layer: 'outer', shape: 'diamond', fill: 'outline', size: 'L', anchor: 'CTR', rotation: 0 }, { type: 'tick', layer: 'inner', length: 30, rotation: 0 }] },
      { row: 2, col: 3, elements: [{ type: 'shape', layer: 'outer', shape: 'square', fill: 'outline', size: 'L', anchor: 'CTR', rotation: 0 }, { type: 'tick', layer: 'inner', length: 30, rotation: 45 }] },
      { row: 3, col: 1, elements: [{ type: 'shape', layer: 'outer', shape: 'diamond', fill: 'outline', size: 'L', anchor: 'CTR', rotation: 0 }, { type: 'tick', layer: 'inner', length: 30, rotation: 270 }] },
      { row: 3, col: 2, elements: [{ type: 'shape', layer: 'outer', shape: 'square', fill: 'outline', size: 'L', anchor: 'CTR', rotation: 0 }, { type: 'tick', layer: 'inner', length: 30, rotation: 315 }] },
    ]
    const axes = detectAllAxes(grid)
    const result = levelA(grid, axes, LRM_2R_XLAYER.domains({ shapeSet: ['square', 'circle', 'diamond'], kShape: 1, startShape: 0, rotBase: 0, colSign: 1, rowSign: -1 }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.impliedByAxis['outer.shape']).toEqual({ t: 'enum', v: 'circle' })
      expect(result.impliedByAxis['inner.rotation']).toEqual({ t: 'num', v: 0 })
    }

    // No two of the 9 (shape, tick) pairs coincide — the defect the
    // correction fixes. Verified here directly, not just asserted in prose.
    const allCells = [...grid, { row: 3, col: 3, elements: [{ type: 'shape' as const, layer: 'outer' as const, shape: 'circle' as const, fill: 'outline' as const, size: 'L' as const, anchor: 'CTR' as const, rotation: 0 }, { type: 'tick' as const, layer: 'inner' as const, length: 30, rotation: 0 }] }]
    const pairs = allCells.map((c) => {
      const shape = c.elements.find((e) => e.type === 'shape')
      const tick = c.elements.find((e) => e.type === 'tick')
      return `${shape && 'shape' in shape ? shape.shape : ''}|${tick && 'rotation' in tick ? tick.rotation : ''}`
    })
    expect(new Set(pairs).size).toBe(pairs.length)
  })
})
