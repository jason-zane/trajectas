import { describe, it, expect } from 'vitest'
import { generateBatch } from '@/lib/cognitive/generator'
import { ALL_FAMILIES } from '@/lib/cognitive/generator/families'
import { runQaBattery } from '@/lib/cognitive/generator/qa'
import { copyEliminationCheck, singleRuleSufficiencyCheck } from '@/lib/cognitive/generator/qa/degeneracy'
import { cellEq, readAxis, axisEq } from '@/lib/cognitive/generator/axes'
import type { CellLike } from '@/lib/cognitive/generator/axes'
import type { Element, GridCell } from '@/lib/cognitive/spec/schema'
import { composeItem } from '@/lib/cognitive/generator/compose'
import { makeRng } from '@/lib/cognitive/generator/rng'
import { LRM_3R_XLAYER } from '@/lib/cognitive/generator/families/lrm-3r-xlayer'
import type { PlacedOption } from '@/lib/cognitive/generator/distractors'

/**
 * Regression cover for two test-wiseness shortcuts that the QA battery
 * MEASURED but never gated, and that consequently shipped in five of eleven
 * families:
 *
 *  - G-11, copy elimination. Every distractor was a verbatim copy of a
 *    visible grid cell and the key never was, so "eliminate any option that
 *    reproduces a cell you can already see" solved the item outright, with
 *    no rule extraction at all. It hit hardest exactly where it mattered
 *    most: LRM-3R-XLAYER and LRM-XOR-DIST-XLAYER, which are the whole
 *    very-hard band.
 *  - G-18, rule-subset sufficiency. One declared rule, applied alone,
 *    identified the key, making the other declared rules (and the difficulty
 *    they are credited with) decorative.
 *
 * The tests below are written to FAIL against the pre-fix generator: the
 * first two pin the gate functions against the exact option-set shapes the
 * old code waved through, and the last two run the real registered bank and
 * assert no accepted item exhibits either shortcut.
 */

const shapeCell = (shape: 'circle' | 'square' | 'triangle', fill: 'outline' | 'solid' | 'hatched'): Element[] => [
  { type: 'shape', layer: 'outer', shape, fill, size: 'M', anchor: 'CTR', rotation: 0 },
]
const gridCell = (row: number, col: number, shape: 'circle' | 'square' | 'triangle', fill: 'outline' | 'solid' | 'hatched'): GridCell => ({ row, col, elements: shapeCell(shape, fill) })

describe('G-11 — copy elimination must never isolate the key', () => {
  const grid: GridCell[] = [
    gridCell(1, 1, 'circle', 'outline'),
    gridCell(1, 2, 'square', 'solid'),
    gridCell(1, 3, 'triangle', 'hatched'),
    gridCell(2, 1, 'square', 'hatched'),
    gridCell(2, 2, 'triangle', 'outline'),
    gridCell(2, 3, 'circle', 'solid'),
    gridCell(3, 1, 'triangle', 'solid'),
    gridCell(3, 2, 'circle', 'hatched'),
  ]

  it('REJECTS the exact defect shape: four distractors that are verbatim copies of visible cells, and a key that is not', () => {
    const options: CellLike[] = [
      { elements: shapeCell('square', 'outline') }, // key — the 9th (shape, fill) pair, in no cell
      { elements: shapeCell('circle', 'outline') }, // copy of R1C1
      { elements: shapeCell('square', 'solid') }, // copy of R1C2
      { elements: shapeCell('triangle', 'hatched') }, // copy of R1C3
      { elements: shapeCell('square', 'hatched') }, // copy of R2C1
    ]
    // Sanity: this really is the shape of the defect — 4 copies, key not one.
    expect(options.map((o) => grid.some((c) => cellEq(c, o)))).toEqual([false, true, true, true, true])

    const result = copyEliminationCheck(grid, options, 0)
    expect(result.status).toBe('fail')
    expect(result.detail?.reason).toBe('COPY_ELIMINATION_ISOLATES_KEY')
    expect(result.detail?.survivorsAfterElimination).toBe(1)
  })

  it('ACCEPTS the same set once one distractor is a figure that appears nowhere on the grid', () => {
    const options: CellLike[] = [
      { elements: shapeCell('square', 'outline') }, // key
      { elements: shapeCell('circle', 'outline') }, // copy of R1C1
      { elements: shapeCell('square', 'solid') }, // copy of R1C2
      { elements: shapeCell('triangle', 'hatched') }, // copy of R1C3
      { elements: [{ type: 'shape', layer: 'outer', shape: 'square', fill: 'outline', size: 'L', anchor: 'CTR', rotation: 0 }] }, // novel: no cell is drawn at size L
    ]
    const result = copyEliminationCheck(grid, options, 0)
    expect(result.status).toBe('pass')
    expect(result.detail?.survivorsAfterElimination).toBe(2)
  })

  it('applies the SAME rule when the key IS a copy (doc OQ-3 / LRM-MOVE): the mirror heuristic "pick the one that repeats a cell" must not isolate it either', () => {
    const keyIsLoneCopy: CellLike[] = [
      { elements: shapeCell('circle', 'outline') }, // key — copy of R1C1
      { elements: [{ type: 'shape', layer: 'outer', shape: 'circle', fill: 'outline', size: 'L', anchor: 'CTR', rotation: 0 }] },
      { elements: [{ type: 'shape', layer: 'outer', shape: 'square', fill: 'outline', size: 'L', anchor: 'CTR', rotation: 0 }] },
      { elements: [{ type: 'shape', layer: 'outer', shape: 'triangle', fill: 'outline', size: 'L', anchor: 'CTR', rotation: 0 }] },
      { elements: [{ type: 'shape', layer: 'outer', shape: 'circle', fill: 'solid', size: 'L', anchor: 'CTR', rotation: 0 }] },
    ]
    expect(copyEliminationCheck(grid, keyIsLoneCopy, 0).status).toBe('fail')

    // Two copies including the key -> the heuristic leaves a real choice.
    const twoCopies = [...keyIsLoneCopy]
    twoCopies[1] = { elements: shapeCell('square', 'solid') } // copy of R1C2
    expect(copyEliminationCheck(grid, twoCopies, 0).status).toBe('pass')
  })
})

describe('G-18 — no single declared rule may isolate the key', () => {
  const axes = ['outer.shape', 'outer.fill']

  it('REJECTS an option set where the key is the only option carrying its own value on one rule axis', () => {
    const options: CellLike[] = [
      { elements: shapeCell('square', 'outline') }, // key
      { elements: shapeCell('circle', 'outline') },
      { elements: shapeCell('triangle', 'outline') },
      { elements: shapeCell('circle', 'solid') },
      { elements: shapeCell('triangle', 'hatched') },
    ]
    const result = singleRuleSufficiencyCheck(options, 0, axes)
    expect(result.status).toBe('fail')
    expect(result.detail?.isolating).toEqual(['outer.shape'])
  })

  it('ACCEPTS an option set where every rule axis leaves at least two survivors', () => {
    const options: CellLike[] = [
      { elements: shapeCell('square', 'outline') }, // key
      { elements: shapeCell('square', 'solid') }, // shares the key's shape
      { elements: shapeCell('circle', 'outline') }, // shares the key's fill
      { elements: shapeCell('circle', 'solid') },
      { elements: shapeCell('triangle', 'hatched') },
    ]
    expect(singleRuleSufficiencyCheck(options, 0, axes).status).toBe('pass')
  })

  it('reports "not applicable" for a single-rule item rather than failing it — the one rule determining the key IS the item', () => {
    const options: CellLike[] = [
      { elements: shapeCell('square', 'outline') },
      { elements: shapeCell('circle', 'outline') },
      { elements: shapeCell('triangle', 'outline') },
      { elements: shapeCell('circle', 'solid') },
      { elements: shapeCell('triangle', 'hatched') },
    ]
    expect(singleRuleSufficiencyCheck(options, 0, ['outer.shape']).status).toBe('pass')
  })
})

describe('the registered bank is free of both shortcuts end to end', () => {
  const result = generateBatch(ALL_FAMILIES, 'shortcut-regression-seed', 6)

  it('no accepted item can be solved by copy elimination, in any family', () => {
    const offenders: string[] = []
    for (const item of result.items) {
      const keyIndex = item.optionSpecs.findIndex((o) => o.slot === item.keySlot)
      const options = item.optionSpecs.map((o) => ({ elements: o.elements }))
      const copyFlags = options.map((o) => item.itemSpec.grid.cells.some((c) => cellEq(c, o)))
      const survivors = copyFlags.filter((f) => f === copyFlags[keyIndex]).length
      if (survivors < 2) offenders.push(`${item.familyCode}/${item.seed} (survivors=${survivors})`)
    }
    expect(offenders).toEqual([])
  })

  it('no accepted multi-rule item can be solved from one CHEAP rule alone, in any family (the hard rule alone is allowed to — solving it is solving the item)', () => {
    // 2026-08-19 (build-plan §1.1 / §2): families that declare a cheap/hard
    // split carry the asymmetric option-set contract — every distractor but
    // one holds the key's cheap values and each carries a distinct hard-rule
    // error — so the HARD axis isolates the key by design and the ≥ 2 rule is
    // scoped to the cheap axes (G-18 re-scoped; G-20 guards the cheap ones).
    // Families with no declaration (both bit-grid rules are comparably hard;
    // 3R-DIST declares all three cheap) are held to every axis, as before.
    const offenders: string[] = []
    for (const item of result.items) {
      const family = ALL_FAMILIES.find((f) => f.code === item.familyCode)!
      if (family.axes.length < 2) continue
      const cheap = family.cheapAxes ?? []
      const hasHardAxis = cheap.length > 0 && cheap.length < family.axes.length
      const axesToCheck = hasHardAxis ? cheap : family.axes
      const keyIndex = item.optionSpecs.findIndex((o) => o.slot === item.keySlot)
      const options = item.optionSpecs.map((o) => ({ elements: o.elements }))
      for (const axis of axesToCheck) {
        const keyValue = readAxis(options[keyIndex], axis)
        if (!keyValue) continue
        const survivors = options.filter((o) => {
          const v = readAxis(o, axis)
          return v !== null && axisEq(v, keyValue)
        }).length
        if (survivors < 2) offenders.push(`${item.familyCode}/${item.seed} axis=${axis}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('G-11 and G-18 are recorded as real gates on every accepted item, not skipped', () => {
    for (const item of result.items) {
      expect(item.qa.gates['G-11'].status, `${item.familyCode}/${item.seed}`).toBe('pass')
      expect(item.qa.gates['G-18'].status, `${item.familyCode}/${item.seed}`).toBe('pass')
    }
  })

  it('G-11 is wired into runQaBattery as a FAILING gate, not a reported statistic: an option set of four whole-cell copies plus the key is refused end to end', () => {
    // Build the defect directly out of a real composed item and hand it to
    // the actual battery — the same call `generateFamily` makes. This is what
    // regressed: before the fix, this exact input returned ok: true with
    // G-11 recorded as 'pass'.
    const composed = composeItem(LRM_3R_XLAYER, makeRng('g11-wiring-proof'))
    const slots = ['A', 'B', 'C', 'D', 'E'] as const
    const placed: PlacedOption[] = slots.map((slot, i) => ({
      slot,
      elements: i === 0 ? [...composed.keyCell.elements] : [...composed.grid[i - 1].elements],
      isKey: i === 0,
      label: i === 0 ? null : ('RP' as const),
      mechanism: i === 0 ? null : `copyCell:R${composed.grid[i - 1].row}C${composed.grid[i - 1].col}`,
    }))
    const outcome = runQaBattery({
      item: composed,
      placedOptions: placed,
      keySlot: 'A',
      existingContentHashes: new Set<string>(),
      existingStructuralHashes: new Set<string>(),
      familyStructuralHashes: new Set<string>(),
      nonCardinalAsymmetricRotation: LRM_3R_XLAYER.nonCardinalAsymmetricRotation(composed.params),
      now: '2026-08-14T00:00:00.000Z',
    })
    expect(outcome.report.gates['G-11'].status).toBe('fail')
    expect(outcome.report.gates['G-11'].detail?.survivorsAfterElimination).toBe(1)
    expect(outcome.ok).toBe(false)
  })
})
