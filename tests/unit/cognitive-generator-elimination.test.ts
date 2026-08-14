import { describe, it, expect } from 'vitest'
import { generateBatch } from '@/lib/cognitive/generator'
import { ALL_FAMILIES } from '@/lib/cognitive/generator/families'
import { eliminationResistanceCheck, keyBulkExtremumCheck, surfaceCensus, surfacePalette } from '@/lib/cognitive/generator/qa/degeneracy'
import { cellComplexity, cellEq } from '@/lib/cognitive/generator/axes'
import type { CellLike } from '@/lib/cognitive/generator/axes'
import type { BarId, Element, GridCell } from '@/lib/cognitive/spec/schema'

/**
 * Regression cover for the SECOND copy-elimination shortcut — the one the
 * first fix (which made G-11 a real gate) created while closing the first.
 *
 * G-11 asks a single question: "eliminate every option that reproduces a
 * visible cell — is the key left alone?". Two families passed it and were
 * still solvable with certainty, because a candidate does not stop at one
 * cue. Chaining a second, equally rule-blind cue behind it —
 *
 *    1. eliminate any option that is a verbatim copy of a visible cell
 *    2. eliminate any option carrying a feature value that appears in NO
 *       visible cell
 *
 * — isolated the key in LRM-XOR-DIST-XLAYER 129/129 and LRM-XOR-XLAYER
 * 121/121 items measured over 20 seeds, while every other registered family
 * sat at 0. The cause was structural, not a weak distractor search: a cell in
 * those families was (3 shapes x 3 two-bar sets) = 9 distinguishable forms
 * and the duplicate-free grid plus the key consumed all 9, so the only
 * non-copy the search could reach was one carrying a bar count no cell
 * showed. Separately, LRM-ADD's key was the strict maximum-ink option in
 * 141/141 items — "pick the fullest tile" solved that family outright.
 *
 * The bank-level tests below are written against the PUBLIC generator API
 * only (no reference to the gates that now enforce these invariants), so
 * they fail against the pre-fix generator on their own terms rather than by
 * failing to import something.
 */

const barCell = (bars: BarId[]): Element[] => [{ type: 'bars', layer: 'inner', bars, clipToOuter: true }]
const shapeAndBars = (shape: 'triangle' | 'square' | 'pentagon', bars: BarId[], fill: 'outline' | 'solid' = 'outline'): Element[] => [
  { type: 'shape', layer: 'outer', shape, fill, size: 'M', anchor: 'CTR', rotation: 0 },
  ...barCell(bars),
]
const at = (row: number, col: number, elements: Element[]): GridCell => ({ row, col, elements })

const AXES = ['outer.shape', 'inner.bars']

describe('G-19 — a cue CHAIN must not isolate the key either', () => {
  // A three-bar grid, every cell showing exactly two bars: the shape the two
  // XOR families had before the vocabulary was widened.
  const narrowGrid: GridCell[] = [
    at(1, 1, shapeAndBars('triangle', ['H', 'V'])),
    at(1, 2, shapeAndBars('square', ['H', 'D1'])),
    at(1, 3, shapeAndBars('pentagon', ['V', 'D1'])),
    at(2, 1, shapeAndBars('triangle', ['H', 'D1'])),
    at(2, 2, shapeAndBars('square', ['V', 'D1'])),
    at(2, 3, shapeAndBars('pentagon', ['H', 'V'])),
    at(3, 1, shapeAndBars('triangle', ['V', 'D1'])),
    at(3, 2, shapeAndBars('square', ['H', 'V'])),
  ]

  it('REJECTS the exact defect shape: three copies, one out-of-vocabulary import, and a key that is the only in-vocabulary novelty', () => {
    const options: CellLike[] = [
      { elements: shapeAndBars('pentagon', ['H', 'D1']) }, // key — the 9th (shape, bar-set) pair, in no cell
      { elements: shapeAndBars('triangle', ['H', 'V']) }, // copy of R1C1
      { elements: shapeAndBars('square', ['H', 'D1']) }, // copy of R1C2
      { elements: shapeAndBars('pentagon', ['V', 'D1']) }, // copy of R1C3
      { elements: shapeAndBars('pentagon', ['D1']) }, // the import: ONE bar, and no cell shows one bar
    ]
    // Sanity: G-11 on its own is perfectly happy with this set — two options
    // survive "eliminate the copies". That is precisely why it was not enough.
    expect(options.filter((o) => !narrowGrid.some((c) => cellEq(c, o))).length).toBe(2)

    const result = eliminationResistanceCheck(narrowGrid, options, 0, AXES)
    expect(result.status).toBe('fail')
    expect(result.detail?.reason).toBe('CUE_CHAIN_ISOLATES_KEY')
    expect(result.detail?.survivors).toBe(1)
  })

  it('ACCEPTS the same option set once a widened vocabulary makes a second in-vocabulary novelty possible', () => {
    // Same grid, but drawn from all four bar positions, so (shape, bar-set)
    // has 18 forms and the 9 the grid consumes leave 9 over.
    const wideGrid: GridCell[] = [
      at(1, 1, shapeAndBars('triangle', ['V', 'D2'])),
      at(1, 2, shapeAndBars('square', ['D1', 'D2'])),
      at(1, 3, shapeAndBars('pentagon', ['V', 'D1'])),
      at(2, 1, shapeAndBars('triangle', ['H', 'D2'])),
      at(2, 2, shapeAndBars('square', ['H', 'D1'])),
      at(2, 3, shapeAndBars('pentagon', ['D1', 'D2'])),
      at(3, 1, shapeAndBars('triangle', ['H', 'V'])),
      at(3, 2, shapeAndBars('square', ['H', 'D2'])),
    ]
    const options: CellLike[] = [
      { elements: shapeAndBars('pentagon', ['V', 'D2']) }, // key
      { elements: shapeAndBars('triangle', ['V', 'D2']) }, // copy of R1C1
      { elements: shapeAndBars('square', ['D1', 'D2']) }, // copy of R1C2
      { elements: shapeAndBars('pentagon', ['V', 'D1']) }, // copy of R1C3
      { elements: shapeAndBars('square', ['V', 'D1']) }, // novel AND in vocabulary: two bars, both seen
    ]
    const result = eliminationResistanceCheck(wideGrid, options, 0, AXES)
    expect(result.status).toBe('pass')
    expect(result.detail?.survivors).toBe(2)
  })

  it('REJECTS novelty that is only skin deep: a distractor differing from a visible cell in FILL alone is still eliminable', () => {
    const options: CellLike[] = [
      { elements: shapeAndBars('pentagon', ['H', 'D1']) }, // key
      { elements: shapeAndBars('triangle', ['H', 'V']) }, // copy of R1C1
      { elements: shapeAndBars('square', ['H', 'D1']) }, // copy of R1C2
      { elements: shapeAndBars('pentagon', ['V', 'D1']) }, // copy of R1C3
      { elements: shapeAndBars('triangle', ['H', 'D1'], 'solid') }, // R2C1 restyled — no rule reads `outer.fill`
    ]
    // `cellEq` calls that last option a novel figure, so G-11 sees two survivors...
    expect(options.filter((o) => !narrowGrid.some((c) => cellEq(c, o))).length).toBe(2)
    // ...but it matches R2C1 on every DECLARED rule axis, and no cell is
    // drawn solid, so a candidate discards it twice over.
    expect(eliminationResistanceCheck(narrowGrid, options, 0, AXES).status).toBe('fail')
  })

  it('does not count a declared rule axis as a "vocabulary" cue — reading the rule axis IS solving the item', () => {
    // LRM-PROG-COUNT's key always shows an element count no cell shows; that
    // is the count progression, not a shortcut.
    const repeat = (count: number): CellLike => ({ elements: [{ type: 'repeat', layer: 'outer', shape: 'circle', fill: 'outline', size: 'S', count, rotation: 0 }] })
    expect(surfaceCensus(repeat(5), ['outer.count'])['repeat:outer']).toBeUndefined()
    expect(surfaceCensus(repeat(5), [])['repeat:outer']).toBe(5)
    // A bar CARDINALITY is never exempt: `inner.bars` declares the set, and
    // counting the bars discards the identities the rule is about.
    expect(surfaceCensus({ elements: barCell(['H', 'V']) }, ['inner.bars'])['bars:inner']).toBe(2)
    expect(surfacePalette({ elements: barCell(['H', 'V']) }, ['inner.bars'])).toEqual(['inner.bar~H', 'inner.bar~V'])
  })
})

describe('G-09 — the key must not be the option a candidate can pick by bulk alone', () => {
  const bars = (n: number): CellLike => ({ elements: barCell((['H', 'V', 'D1', 'D2'] as BarId[]).slice(0, n)) })

  it('REJECTS the exact defect shape: the key is the strict maximum-ink option', () => {
    const result = keyBulkExtremumCheck([bars(4), bars(3), bars(2), bars(2), bars(2)], 0)
    expect(result.status).toBe('fail')
    expect(result.detail?.at).toBe('max')
  })

  it('REJECTS the mirror (strict minimum) and ACCEPTS a key whose bulk another option shares', () => {
    expect(keyBulkExtremumCheck([bars(1), bars(3), bars(2), bars(2), bars(2)], 0).status).toBe('fail')
    expect(keyBulkExtremumCheck([bars(3), bars(3), bars(3), bars(2), bars(3)], 0).status).toBe('pass')
  })
})

/**
 * Bank-level. These reproduce the audit's own measurement over the real
 * registered families rather than over a hand-built fixture, and they are
 * written with the generator's public API only.
 */
describe('the registered bank is free of rule-blind cue shortcuts', () => {
  const SEEDS = ['anom-seed-0', 'anom-seed-1', 'anom-seed-2', 'anom-seed-3']
  const items = SEEDS.flatMap((seed) => generateBatch(ALL_FAMILIES, seed, 6).items)

  const fingerprint = (els: readonly Element[]) => JSON.stringify(els)

  /** Counts a candidate can read off a figure without knowing any rule. */
  function census(els: readonly Element[]): Record<string, number> {
    const f: Record<string, number> = { elements: els.length }
    for (const e of els) {
      f[`type:${e.type}`] = (f[`type:${e.type}`] ?? 0) + 1
      if (e.type === 'bars') f[`bars:${e.layer}`] = e.bars.length
      if (e.type === 'dots') f[`dots:${e.layer}`] = e.anchors.length
    }
    return f
  }

  it('no accepted item is isolated by "eliminate the copies, then eliminate the impossible"', () => {
    const isolated: string[] = []
    for (const item of items) {
      const gridPrints = new Set(item.itemSpec.grid.cells.map((c) => fingerprint(c.elements)))
      const vocab: Record<string, Set<number>> = {}
      for (const c of item.itemSpec.grid.cells) for (const [k, v] of Object.entries(census(c.elements))) (vocab[k] ??= new Set()).add(v)

      const survivors = item.optionSpecs.filter((o) => {
        if (gridPrints.has(fingerprint(o.elements))) return false
        return Object.entries(census(o.elements)).every(([k, v]) => vocab[k]?.has(v))
      })
      if (survivors.length === 1 && survivors[0].slot === item.keySlot) isolated.push(`${item.familyCode} ${item.seed}`)
    }
    expect(isolated).toEqual([])
  })

  it('the key is never the lone bulk extremum among its options', () => {
    const offenders: string[] = []
    for (const item of items) {
      const counts = item.optionSpecs.map((o) => cellComplexity({ elements: o.elements }))
      const keyCount = counts[item.optionSpecs.findIndex((o) => o.slot === item.keySlot)]
      if (counts.filter((c) => c === keyCount).length > 1) continue
      if (counts.every((c) => c <= keyCount) || counts.every((c) => c >= keyCount)) offenders.push(`${item.familyCode} ${item.seed}`)
    }
    expect(offenders).toEqual([])
  })

  it('every XOR-family item offers at least one distractor that is novel AND drawn from the grid’s own bar vocabulary', () => {
    const xor = items.filter((i) => i.familyCode === 'LRM-XOR-XLAYER' || i.familyCode === 'LRM-XOR-DIST-XLAYER')
    expect(xor.length).toBeGreaterThan(20)
    for (const item of xor) {
      const gridPrints = new Set(item.itemSpec.grid.cells.map((c) => fingerprint(c.elements)))
      const gridBarCounts = new Set(item.itemSpec.grid.cells.map((c) => c.elements.find((e) => e.type === 'bars')!.bars.length))
      const honest = item.optionSpecs.filter((o) => {
        if (o.slot === item.keySlot) return false
        if (gridPrints.has(fingerprint(o.elements))) return false
        const bars = o.elements.find((e) => e.type === 'bars')
        return !!bars && gridBarCounts.has(bars.bars.length)
      })
      expect(honest.length, `${item.familyCode} ${item.seed}`).toBeGreaterThanOrEqual(1)
    }
  })
})
