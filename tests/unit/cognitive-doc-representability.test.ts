import { describe, it, expect } from 'vitest'
import { GridCell, OptionSpec, type Element } from '@/lib/cognitive/spec/schema'

/**
 * Issue #344's explicit acceptance criterion: "A test asserts every worked
 * item in doc 03 §6 is representable in the normative schema, so this class
 * of drift fails loudly next time." (This class of drift: doc 03-logical-
 * reasoning-design.md's M1 option D specified 6 circles while
 * `RepeatElement.count` capped at 5 — a worked item the schema could not
 * express at all, silently papered over by a fixture substitution rather
 * than caught by a test.)
 *
 * This file hand-encodes the CURRENT text of doc 03 §6's eight worked
 * exemplars (M1-M8), including the two representability corrections issue
 * #344/#346 made along the way — M1's option D (now 6 circles, the count
 * cap having been raised) and M2's option E (now a hatched arrow instead of
 * a "double-headed arrow", which the closed shape vocabulary has never
 * been able to express) — and asserts every grid cell and every option
 * parses through the normative `GridCell`/`OptionSpec` zod schemas.
 *
 * Scope, deliberately: this checks REPRESENTABILITY (can the schema
 * express this content at all), not uniqueness, QA-battery-passing, or
 * duplicate-freeness. Several of these hand-encoded grids (M1, M7) are
 * known to fail the generator's own context-blind gate as literally
 * written (see cognitive-generator-contextblind.test.ts and Appendix A of
 * doc 03-item-generation-pipeline.md) — that is a separate, already-pinned
 * class of finding. A grid can be perfectly representable in the schema
 * and still be a bad item; this test only guards the former.
 */

type RawCell = { row: number; col: number; elements: Element[] }
type RawOption = { slot: 'A' | 'B' | 'C' | 'D' | 'E'; elements: Element[] }

function assertAllRepresentable(name: string, grid: RawCell[], options: RawOption[]) {
  describe(name, () => {
    it('every context-grid cell parses through GridCell', () => {
      for (const cell of grid) {
        const result = GridCell.safeParse(cell)
        expect(result.success, `${name} (${cell.row},${cell.col}): ${result.success ? '' : JSON.stringify(result.error.issues)}`).toBe(true)
      }
      expect(grid).toHaveLength(8)
    })

    it('every option parses through OptionSpec', () => {
      for (const opt of options) {
        const result = OptionSpec.safeParse(opt)
        expect(result.success, `${name} option ${opt.slot}: ${result.success ? '' : JSON.stringify(result.error.issues)}`).toBe(true)
      }
      expect(options).toHaveLength(5)
      expect(options.map((o) => o.slot)).toEqual(['A', 'B', 'C', 'D', 'E'])
    })
  })
}

// ---------------------------------------------------------------------------
// M1 — double count progression (issue #344: option D is 6 circles, now
// representable since the count cap was raised from 5 to 6).
// ---------------------------------------------------------------------------
{
  const repeatCircle = (count: number, fill: 'solid' | 'hatched' = 'solid'): Element[] => [{ type: 'repeat', layer: 'outer', shape: 'circle', fill, size: 'S', count, rotation: 0 }]
  const grid: RawCell[] = [
    { row: 1, col: 1, elements: repeatCircle(1) },
    { row: 1, col: 2, elements: repeatCircle(2) },
    { row: 1, col: 3, elements: repeatCircle(3) },
    { row: 2, col: 1, elements: repeatCircle(2) },
    { row: 2, col: 2, elements: repeatCircle(3) },
    { row: 2, col: 3, elements: repeatCircle(4) },
    { row: 3, col: 1, elements: repeatCircle(3) },
    { row: 3, col: 2, elements: repeatCircle(4) },
  ]
  const options: RawOption[] = [
    { slot: 'A', elements: repeatCircle(4) },
    { slot: 'B', elements: repeatCircle(5) },
    { slot: 'C', elements: repeatCircle(3) },
    { slot: 'D', elements: repeatCircle(6) }, // doc's true wrong-rule value — issue #344
    { slot: 'E', elements: [{ type: 'repeat', layer: 'outer', shape: 'square', fill: 'solid', size: 'S', count: 5, rotation: 0 }] },
  ]
  assertAllRepresentable('M1 — double count progression', grid, options)
}

// ---------------------------------------------------------------------------
// M2 — arrow rotation progression (issue #344: option E corrected from an
// unrepresentable "double-headed arrow" to a hatched arrow at the same angle).
// ---------------------------------------------------------------------------
{
  const arrow = (rotation: number, fill: 'outline' | 'hatched' = 'outline'): Element[] => [{ type: 'shape', layer: 'outer', shape: 'arrow', fill, size: 'M', anchor: 'CTR', rotation }]
  const grid: RawCell[] = [
    { row: 1, col: 1, elements: arrow(0) },
    { row: 1, col: 2, elements: arrow(45) },
    { row: 1, col: 3, elements: arrow(90) },
    { row: 2, col: 1, elements: arrow(90) },
    { row: 2, col: 2, elements: arrow(135) },
    { row: 2, col: 3, elements: arrow(180) },
    { row: 3, col: 1, elements: arrow(180) },
    { row: 3, col: 2, elements: arrow(225) },
  ]
  const options: RawOption[] = [
    { slot: 'A', elements: arrow(315) },
    { slot: 'B', elements: arrow(225) },
    { slot: 'C', elements: arrow(90) },
    { slot: 'D', elements: arrow(270) },
    { slot: 'E', elements: arrow(270, 'hatched') }, // corrected — issue #344
  ]
  assertAllRepresentable('M2 — arrow rotation progression', grid, options)
}

// ---------------------------------------------------------------------------
// M3 — distribution of three, two attributes.
// ---------------------------------------------------------------------------
{
  const shape = (s: 'circle' | 'square' | 'triangle', fill: 'solid' | 'outline' | 'hatched'): Element[] => [{ type: 'shape', layer: 'outer', shape: s, fill, size: 'M', anchor: 'CTR', rotation: 0 }]
  const grid: RawCell[] = [
    { row: 1, col: 1, elements: shape('circle', 'solid') },
    { row: 1, col: 2, elements: shape('square', 'outline') },
    { row: 1, col: 3, elements: shape('triangle', 'hatched') },
    { row: 2, col: 1, elements: shape('triangle', 'outline') },
    { row: 2, col: 2, elements: shape('circle', 'hatched') },
    { row: 2, col: 3, elements: shape('square', 'solid') },
    { row: 3, col: 1, elements: shape('square', 'hatched') },
    { row: 3, col: 2, elements: shape('triangle', 'solid') },
  ]
  const options: RawOption[] = [
    { slot: 'A', elements: shape('circle', 'outline') },
    { slot: 'B', elements: shape('circle', 'solid') },
    { slot: 'C', elements: shape('square', 'outline') },
    { slot: 'D', elements: shape('circle', 'hatched') },
    { slot: 'E', elements: shape('triangle', 'outline') },
  ]
  assertAllRepresentable('M3 — distribution of three, two attributes', grid, options)
}

// ---------------------------------------------------------------------------
// M4 — figure addition (bar superimposition).
// ---------------------------------------------------------------------------
{
  const bars = (b: Array<'H' | 'V' | 'D1' | 'D2'>): Element[] => [{ type: 'bars', layer: 'outer', bars: b, clipToOuter: false }]
  const grid: RawCell[] = [
    { row: 1, col: 1, elements: bars(['H']) },
    { row: 1, col: 2, elements: bars(['V']) },
    { row: 1, col: 3, elements: bars(['H', 'V']) },
    { row: 2, col: 1, elements: bars(['D1']) },
    { row: 2, col: 2, elements: bars(['D2']) },
    { row: 2, col: 3, elements: bars(['D1', 'D2']) },
    { row: 3, col: 1, elements: bars(['H', 'D1']) },
    { row: 3, col: 2, elements: bars(['V', 'D2']) },
  ]
  const options: RawOption[] = [
    { slot: 'A', elements: bars(['H', 'V']) },
    { slot: 'B', elements: bars(['D1', 'D2']) },
    { slot: 'C', elements: bars(['H', 'V', 'D1', 'D2']) },
    { slot: 'D', elements: bars(['H', 'V', 'D1']) },
    { slot: 'E', elements: bars(['H', 'D1']) },
  ]
  assertAllRepresentable('M4 — figure addition', grid, options)
}

// ---------------------------------------------------------------------------
// M5 — figure subtraction (positioned dots).
// ---------------------------------------------------------------------------
{
  const dots = (a: Array<'TL' | 'TR' | 'BL' | 'BR' | 'CTR'>): Element[] => [{ type: 'dots', layer: 'satellite', anchors: a, fill: 'solid', size: 'S' }]
  const grid: RawCell[] = [
    { row: 1, col: 1, elements: dots(['TL', 'TR', 'BL']) },
    { row: 1, col: 2, elements: dots(['TR']) },
    { row: 1, col: 3, elements: dots(['TL', 'BL']) },
    { row: 2, col: 1, elements: dots(['TL', 'TR', 'BR', 'CTR']) },
    { row: 2, col: 2, elements: dots(['TR', 'CTR']) },
    { row: 2, col: 3, elements: dots(['TL', 'BR']) },
    { row: 3, col: 1, elements: dots(['TL', 'BL', 'BR', 'CTR']) },
    { row: 3, col: 2, elements: dots(['BL']) },
  ]
  const options: RawOption[] = [
    { slot: 'A', elements: dots(['TL', 'BR']) },
    { slot: 'B', elements: dots(['TL', 'BL', 'BR', 'CTR']) },
    { slot: 'C', elements: dots(['BL']) },
    { slot: 'D', elements: dots(['TR', 'BR', 'CTR']) },
    { slot: 'E', elements: dots(['TL', 'BR', 'CTR']) },
  ]
  assertAllRepresentable('M5 — figure subtraction', grid, options)
}

// ---------------------------------------------------------------------------
// M6 — two rules, cross-layer (issue #346's corrected, duplicate-free
// table — 45deg tick step; see tests/fixtures/cognitive/m6.ts).
// ---------------------------------------------------------------------------
{
  const cell = (s: 'square' | 'circle' | 'diamond', tick: number): Element[] => [
    { type: 'shape', layer: 'outer', shape: s, fill: 'outline', size: 'L', anchor: 'CTR', rotation: 0 },
    { type: 'tick', layer: 'inner', length: 30, rotation: tick },
  ]
  const grid: RawCell[] = [
    { row: 1, col: 1, elements: cell('square', 0) },
    { row: 1, col: 2, elements: cell('circle', 45) },
    { row: 1, col: 3, elements: cell('diamond', 90) },
    { row: 2, col: 1, elements: cell('circle', 315) },
    { row: 2, col: 2, elements: cell('diamond', 0) },
    { row: 2, col: 3, elements: cell('square', 45) },
    { row: 3, col: 1, elements: cell('diamond', 270) },
    { row: 3, col: 2, elements: cell('square', 315) },
  ]
  const options: RawOption[] = [
    { slot: 'A', elements: cell('square', 0) },
    { slot: 'B', elements: cell('circle', 0) },
    { slot: 'C', elements: cell('square', 45) },
    { slot: 'D', elements: cell('square', 315) },
    { slot: 'E', elements: cell('circle', 45) },
  ]
  assertAllRepresentable('M6 — two rules, cross-layer (corrected)', grid, options)
}

// ---------------------------------------------------------------------------
// M7 — three rules: shape + fill distribution + count progression.
// ---------------------------------------------------------------------------
{
  const rep = (s: 'circle' | 'square' | 'triangle', fill: 'solid' | 'outline' | 'hatched', count: number): Element[] => [{ type: 'repeat', layer: 'outer', shape: s, fill, size: 'S', count, rotation: 0 }]
  const grid: RawCell[] = [
    { row: 1, col: 1, elements: rep('circle', 'solid', 1) },
    { row: 1, col: 2, elements: rep('square', 'outline', 2) },
    { row: 1, col: 3, elements: rep('triangle', 'hatched', 3) },
    { row: 2, col: 1, elements: rep('triangle', 'outline', 1) },
    { row: 2, col: 2, elements: rep('circle', 'hatched', 2) },
    { row: 2, col: 3, elements: rep('square', 'solid', 3) },
    { row: 3, col: 1, elements: rep('square', 'hatched', 1) },
    { row: 3, col: 2, elements: rep('triangle', 'solid', 2) },
  ]
  const options: RawOption[] = [
    { slot: 'A', elements: rep('circle', 'hatched', 3) },
    { slot: 'B', elements: rep('circle', 'outline', 2) },
    { slot: 'C', elements: rep('circle', 'solid', 3) },
    { slot: 'D', elements: rep('circle', 'outline', 3) },
    { slot: 'E', elements: rep('triangle', 'outline', 3) },
  ]
  assertAllRepresentable('M7 — three rules, near-miss-dominant options', grid, options)
}

// ---------------------------------------------------------------------------
// M8 — XOR with cross-layer progression (issue #346's corrected,
// duplicate-free table — every cell exactly 2 of 3 bars).
// ---------------------------------------------------------------------------
{
  const cell = (s: 'triangle' | 'square' | 'pentagon', b: Array<'H' | 'V' | 'D1'>): Element[] => [
    { type: 'shape', layer: 'outer', shape: s, fill: 'outline', size: 'L', anchor: 'CTR', rotation: 0 },
    { type: 'bars', layer: 'inner', bars: b, clipToOuter: true },
  ]
  const grid: RawCell[] = [
    { row: 1, col: 1, elements: cell('triangle', ['H', 'V']) },
    { row: 1, col: 2, elements: cell('square', ['V', 'D1']) },
    { row: 1, col: 3, elements: cell('pentagon', ['H', 'D1']) },
    { row: 2, col: 1, elements: cell('triangle', ['H', 'D1']) },
    { row: 2, col: 2, elements: cell('square', ['H', 'V']) },
    { row: 2, col: 3, elements: cell('pentagon', ['V', 'D1']) },
    { row: 3, col: 1, elements: cell('triangle', ['V', 'D1']) },
    { row: 3, col: 2, elements: cell('square', ['H', 'D1']) },
  ]
  const options: RawOption[] = [
    { slot: 'A', elements: cell('pentagon', ['H', 'V']) },
    { slot: 'B', elements: [{ type: 'shape', layer: 'outer', shape: 'pentagon', fill: 'outline', size: 'L', anchor: 'CTR', rotation: 0 }, { type: 'bars', layer: 'inner', bars: ['D1'], clipToOuter: true }] },
    { slot: 'C', elements: cell('pentagon', ['H', 'D1', 'V']) },
    { slot: 'D', elements: cell('square', ['H', 'V']) },
    { slot: 'E', elements: cell('pentagon', ['H', 'D1']) }, // corrected — issue #346
  ]
  assertAllRepresentable('M8 — XOR with cross-layer progression (corrected)', grid, options)
}
