/**
 * LRM-3R-DIST — M7's family. Doc 03-logical-reasoning-design.md §6 M7:
 * three rules — R6 (shape, Latin square) + R6 (fill, Latin square) + R1
 * (count = column index: 1, 2, 3). Shape and fill reuse LRM-DIST3X2's
 * orthogonal cyclic-Latin-square construction (kShape != kFill in {1,2} —
 * see that family's header note for why that pairing is what guarantees
 * every (shape, fill) combination across the 9 cells is distinct); count
 * is independent of both (it depends only on column).
 *
 * FINDING: doc 03-item-generation-pipeline.md Appendix A marks M7 as the
 * WORST context-blind failure of the eight exemplars ("the key is modal on
 * all three axes") and works through an iterative, MANUALLY-TUNED repair
 * (§ Appendix A, "Worked for M7") that ends up moving one distractor's
 * shape TWICE before it clears G-08. That repair is specific to doc's own
 * fixed shape/fill choice and is not a formula this family can reuse
 * across arbitrary incidental draws. As with LRM-DIST3X2/LRM-2R-XLAYER,
 * this family instead searches a candidate pool (context-cell copies, and
 * context-cell copies with count overridden to each of the other two
 * values) for a 4-subset that clears the real gates — the same repair
 * PRINCIPLE doc's manual pass follows, executed generally.
 */
import type { Element, Fill, RuleSpec, ShapeId } from '../../spec/schema'
import { enumVal, numVal, cellEq } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx, DistractorCandidate } from '../compose'
import { chimera } from '../distractors'
import type { Rng } from '../rng'
import { contextBlindGate, giveawayPairGate } from '../qa/contextblind'
import { combinations4 } from '../combinatorics'

const SHAPE_AXIS = 'outer.shape'
const FILL_AXIS = 'outer.fill'
const COUNT_AXIS = 'outer.count'

// Restricted to circle/square/pentagon — see LRM-PROG-COUNT's header note
// (same finding, same fix): at count=1, size S=25, triangle (~0.027 ink
// fraction) and diamond (~0.031) both fall below the 0.04 G-15 floor. This
// family also renders `repeat` elements down to count=1, so the same
// restriction applies — and those three shapes are the only ones that
// clear the floor, so there is exactly one safe 3-element set; incidental
// diversity comes from `kShape`/`startShape` (which physical shape plays
// which Latin-square role) rather than from swapping the set itself.
const SHAPE_SETS = [['circle', 'square', 'pentagon']] as const
const FILL_LADDER = ['outline', 'solid', 'hatched'] as const

export interface M7Params {
  shapeSet: readonly [string, string, string]
  kShape: 1 | 2
  kFill: 1 | 2
  startShape: 0 | 1 | 2
  startFill: 0 | 1 | 2
}

function cyclicLatin<T>(ladder: readonly T[], k: number, start: number, row: number, col: number): T {
  const idx = (((start + (col - 1) + k * (row - 1)) % 3) + 3) % 3
  return ladder[idx]
}

function repeatCell(shape: string, fill: string, count: number): Element[] {
  return [{ type: 'repeat', layer: 'outer', shape: shape as ShapeId, fill: fill as Fill, size: 'S', count, rotation: 0 }]
}

export const LRM_3R_DIST: FamilyTemplate<M7Params> = {
  code: 'LRM-3R-DIST',
  axes: [SHAPE_AXIS, FILL_AXIS, COUNT_AXIS],
  domains: () => ({
    [SHAPE_AXIS]: { kind: 'unordered-enum' } as AxisDomain,
    [FILL_AXIS]: { kind: 'unordered-enum', ladder: FILL_LADDER.map(enumVal) } as AxisDomain,
    [COUNT_AXIS]: { kind: 'numeric-linear' } as AxisDomain,
  }),
  valueAt: (axis, row, col, params) => {
    if (axis === SHAPE_AXIS) return enumVal(cyclicLatin(params.shapeSet, params.kShape, params.startShape, row, col))
    if (axis === FILL_AXIS) return enumVal(cyclicLatin(FILL_LADDER, params.kFill, params.startFill, row, col))
    if (axis === COUNT_AXIS) return numVal(col)
    throw new Error(`unknown axis ${axis}`)
  },
  ruleSpecs: (params): RuleSpec[] => [
    {
      id: 'R6',
      axis: SHAPE_AXIS,
      direction: 'both',
      params: { values: [...params.shapeSet], rowOffset: params.kShape },
      statement: `Outer shape forms a Latin square: each of ${params.shapeSet.join(', ')} appears exactly once per row and once per column.`,
    },
    {
      id: 'R6',
      axis: FILL_AXIS,
      direction: 'both',
      params: { values: [...FILL_LADDER], rowOffset: params.kFill },
      statement: `Fill forms a Latin square: each of ${FILL_LADDER.join(', ')} appears exactly once per row and once per column.`,
    },
    {
      id: 'R1',
      axis: COUNT_AXIS,
      direction: 'column',
      params: { base: 1, stepPerColumn: 1, stepPerRow: 0 },
      statement: 'Count equals the column index: 1 in column 1, 2 in column 2, 3 in column 3, for every row.',
    },
  ],
  radicals: { ruleCount: 3, ruleIds: ['R6', 'R6', 'R1'], crossLayer: false, perceptualLoad: 1, elementTypes: 3, nearMissCount: 3 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 },
  distractorPlan: ['IR', 'IR', 'IR', 'PM'],
  sampleParams(rng: Rng): M7Params {
    const shapeSet = rng.pick(SHAPE_SETS)
    const [kShape, kFill] = rng.pick([
      [1, 2],
      [2, 1],
    ] as const)
    const startShape = rng.int(0, 2) as 0 | 1 | 2
    const startFill = rng.int(0, 2) as 0 | 1 | 2
    return { shapeSet: shapeSet as unknown as [string, string, string], kShape, kFill, startShape, startFill }
  },
  buildCell(values) {
    const shape = values[SHAPE_AXIS]
    const fill = values[FILL_AXIS]
    const count = values[COUNT_AXIS]
    if (shape.t !== 'enum' || fill.t !== 'enum' || count.t !== 'num') throw new Error('shape/fill/count must be enum/enum/num')
    return repeatCell(shape.v, fill.v, count.v)
  },
  /**
   * Pool: every context cell's own (shape, fill, count), PLUS the same
   * cell with count overridden to each of the other two values (1, 2, 3
   * minus its own) — 8 + 16 = 24 candidates. Search 4-subsets (labelled
   * IR, IR, IR, PM per doc's own "three IR + one PM" M7 design note,
   * doc 03-logical-reasoning-design.md §6 M7's closing paragraph) for one
   * that clears G-08 and G-10 against the fixed key.
   */
  buildDistractors(ctx: DistractorCtx<M7Params>) {
    const keyShape = ctx.valueAt(SHAPE_AXIS, 3, 3)
    const keyFill = ctx.valueAt(FILL_AXIS, 3, 3)
    const keyCount = ctx.valueAt(COUNT_AXIS, 3, 3)
    if (keyShape.t !== 'enum' || keyFill.t !== 'enum' || keyCount.t !== 'num') throw new Error('shape/fill/count must be enum/enum/num')

    type Candidate = { shape: string; fill: string; count: number; mechanism: string }
    const pool: Candidate[] = []
    for (const gc of ctx.grid) {
      const s = ctx.valueAt(SHAPE_AXIS, gc.row, gc.col)
      const f = ctx.valueAt(FILL_AXIS, gc.row, gc.col)
      const c = ctx.valueAt(COUNT_AXIS, gc.row, gc.col)
      if (s.t !== 'enum' || f.t !== 'enum' || c.t !== 'num') throw new Error('shape/fill/count must be enum/enum/num')
      pool.push({ shape: s.v, fill: f.v, count: c.v, mechanism: `copyCell:R${gc.row}C${gc.col}` })
      for (const altCount of [1, 2, 3]) {
        if (altCount === c.v) continue
        pool.push({ shape: s.v, fill: f.v, count: altCount, mechanism: `copyCell:R${gc.row}C${gc.col}+recount[${altCount}]` })
      }
    }
    const filteredPool = pool.filter((p) => !(p.shape === keyShape.v && p.fill === keyFill.v && p.count === keyCount.v))

    const labels: Array<'IR' | 'PM'> = ['IR', 'IR', 'IR', 'PM']
    const validSet = (candidates: DistractorCandidate[]): boolean => {
      if (candidates.some((cd) => cd.wrongAxes.length === 0)) return false
      if (candidates.some((cd) => cellEq({ elements: cd.elements }, ctx.keyCell))) return false
      for (let i = 0; i < candidates.length; i++)
        for (let j = i + 1; j < candidates.length; j++) if (cellEq({ elements: candidates[i].elements }, { elements: candidates[j].elements })) return false
      const cells = [{ elements: ctx.keyCell.elements }, ...candidates.map((x) => ({ elements: x.elements }))]
      return contextBlindGate(cells, 0, ctx.axes).ok && giveawayPairGate(cells, ctx.axes).ok
    }

    for (const chosen of combinations4(filteredPool)) {
      const candidates: DistractorCandidate[] = chosen.map((p, i) => {
        const wrongAxes = [...(p.shape === keyShape.v ? [] : [SHAPE_AXIS]), ...(p.fill === keyFill.v ? [] : [FILL_AXIS]), ...(p.count === keyCount.v ? [] : [COUNT_AXIS])]
        const elements = repeatCell(p.shape, p.fill, p.count)
        return labels[i] === 'PM' ? chimera(p.mechanism, elements, wrongAxes) : { elements, label: 'IR' as const, mechanism: p.mechanism, wrongAxes }
      })
      if (validSet(candidates)) return candidates
    }
    throw new Error(`LRM-3R-DIST: no distractor construction cleared both G-08 and G-10 for params ${JSON.stringify(ctx.params)}`)
  },
  nonCardinalAsymmetricRotation: () => false,
  structuralExtra: (params: M7Params) => ({ startShape: params.startShape, startFill: params.startFill }),
}
