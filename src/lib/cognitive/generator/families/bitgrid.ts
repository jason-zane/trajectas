/**
 * Shared vocabulary for the bit-grid Boolean families (LRM-BITS-XOR,
 * LRM-BITS-2OP). Build-plan 2026-08-19-cognitive-v2-build-plan.md §4;
 * precedent: Schroeders & Walter (2026), BOLT — matrices generated from
 * Boolean algebra, where the number of binary operations and the perceptual
 * organisation of the stimulus are what drive difficulty.
 *
 * A bit-grid element is a 3×3 mini-grid filling the cell; each of its nine
 * positions (row-major, 0 = top-left, 8 = bottom-right) is empty, black or
 * hatched. `outer.black` and `outer.hatched` are set-valued rule axes over
 * those positions — the same axis kind `inner.bars` and `satellite.anchors`
 * already are, so the row set-operator rules (R4 union / R5 difference / R7
 * symmetric difference, rules.ts) verify them unchanged. The vocabulary is
 * 2⁹ values per layer, which is what retires the `dist3x2` pigeonhole: nine
 * grid cells cannot exhaust it.
 *
 * Not a family itself and not registered.
 */
import type { Element, GridCell } from '../../spec/schema'
import type { AxisId, AxisValue } from '../axes'
import { setVal } from '../axes'
import type { Rng } from '../rng'
import type { AxisDomain } from '../rules'
import { detectAllAxes, levelA } from '../qa/uniqueness'

export type Pos = number

export const ALL_POSITIONS: readonly Pos[] = [0, 1, 2, 3, 4, 5, 6, 7, 8]

export const BLACK_AXIS = 'outer.black'
export const HATCHED_AXIS = 'outer.hatched'

export function sortPos(xs: readonly Pos[]): Pos[] {
  return [...new Set(xs)].sort((a, b) => a - b)
}
export function xorSet(a: readonly Pos[], b: readonly Pos[]): Pos[] {
  const A = new Set(a)
  const B = new Set(b)
  return sortPos([...a.filter((x) => !B.has(x)), ...b.filter((x) => !A.has(x))])
}
export function unionSet(a: readonly Pos[], b: readonly Pos[]): Pos[] {
  return sortPos([...a, ...b])
}
export function minusSet(a: readonly Pos[], b: readonly Pos[]): Pos[] {
  const B = new Set(b)
  return sortPos(a.filter((x) => !B.has(x)))
}
export function interSet(a: readonly Pos[], b: readonly Pos[]): Pos[] {
  const B = new Set(b)
  return sortPos(a.filter((x) => B.has(x)))
}
export function sameSet(a: readonly Pos[], b: readonly Pos[]): boolean {
  const A = sortPos(a)
  const B = sortPos(b)
  return A.length === B.length && A.every((x, i) => x === B[i])
}
export function posSetVal(xs: readonly Pos[]): AxisValue {
  return setVal(sortPos(xs).map((x) => String(x)))
}
export function fromSetVal(v: AxisValue): Pos[] {
  if (v.t !== 'set') throw new Error('bit-grid axis value must be a set')
  return sortPos(v.v.map((x) => Number.parseInt(x, 10)))
}

/**
 * Level A (qa/uniqueness.ts) enumerates, for every set-valued axis, the four
 * row operators AND the four column operators (rules.ts). A grid whose two
 * visible row-3 cells happen to equal `op(R1Cc, R2Cc)` for one op on both
 * columns admits a rival column reading — and Level A treats that as a
 * generation bug (`UNSOLVABLE_AT_GENERATION` throws; it is not a reject).
 * Families call this on the SAME axis lattice before accepting a draw. Small
 * domains make the coincidence common (a 4-position hatched domain has only
 * six 2-sets), which is why it is checked here rather than trusted to luck.
 */
export function columnOperatorCoincidence(colVals: (c: 1 | 2 | 3, r: 1 | 2 | 3) => readonly Pos[]): boolean {
  const ops: Array<(a: readonly Pos[], b: readonly Pos[]) => Pos[]> = [unionSet, minusSet, (a, b) => minusSet(b, a), xorSet]
  return ops.some((op) => ([1, 2] as const).every((c) => sameSet(colVals(c, 3), op(colVals(c, 1), colVals(c, 2)))))
}

/**
 * The generator throws — it does not reject — when its own grid is not
 * uniquely solvable (`UNSOLVABLE_AT_GENERATION`, generator/index.ts), because
 * for the shape families that is a construction bug. For bit-grids over a
 * five- or four-position domain it is ordinary bad luck: Level A's
 * accidental-regularity probes (column-constant, main-diagonal, …) fire on
 * a real fraction of draws — R1C3 = R2C3 whenever two rows share the same
 * shared position — and no closed form of the operand sampling avoids every
 * probe. So the sampler asks the SAME verifier, on the SAME grid it is about
 * to return, and redraws when the answer is no. This does not make the
 * verifier trust the generator (Level A still runs, independently, on every
 * item); it makes the family avoid draws it can prove would throw.
 */
export function uniquelySolvable(cells: readonly GridCell[], declaredAxes: readonly AxisId[], domains: Partial<Record<AxisId, AxisDomain>>): boolean {
  const axes = [...new Set([...declaredAxes, ...detectAllAxes(cells)])]
  return levelA(cells, axes, domains).ok
}

export function bitgridCell(black: readonly Pos[], hatched: readonly Pos[]): Element[] {
  return [{ type: 'bitgrid', layer: 'outer', black: sortPos(black), hatched: sortPos(hatched) }]
}

/**
 * Two operand sets over `domain`, each of `size` positions, sharing exactly
 * `overlap` of them. Rejection-free: the shared positions are drawn first,
 * then the two exclusive parts from what remains. Sizes are chosen so the
 * result of the row operator lands at a cardinality the option set can be
 * built around (see each family's header).
 */
export function sampleOperandPair(rng: Rng, domain: readonly Pos[], size: number, overlap: number): { a: Pos[]; b: Pos[]; shared: Pos[] } {
  const pool = rng.shuffle([...domain])
  const shared = pool.slice(0, overlap)
  const rest = pool.slice(overlap)
  const aOnly = rest.slice(0, size - overlap)
  const bOnly = rest.slice(size - overlap, 2 * (size - overlap))
  return { a: sortPos([...shared, ...aOnly]), b: sortPos([...shared, ...bOnly]), shared: sortPos(shared) }
}
