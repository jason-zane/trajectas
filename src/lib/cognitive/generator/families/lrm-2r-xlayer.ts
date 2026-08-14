/**
 * LRM-2R-XLAYER — M6's family. Doc 03-logical-reasoning-design.md §6 M6:
 * two rules, cross-layer — R6 (outer shape, Latin square) + R2 (inner tick
 * rotation, doc's own choice: +90deg/column with a +90deg/row offset). This
 * is doc 03-item-generation-pipeline.md §2.4's fully-worked example, and
 * its own §3.5/Appendix A analysis found the AS-WRITTEN option set fails
 * G-08 (context-blind) and supplies a REPAIRED option set (§4.5) that
 * passes. This family implements that repair (fixed source positions: IR
 * on rotation from R3C2, IR on shape from R3C1, PM as a genuine two-axis
 * chimera of R3C2's shape + R3C1's rotation, RP as a full copy of R3C2) —
 * verified against doc's own repaired table while writing this file.
 *
 * FURTHER FINDING (grid-level, independent of the G-08 issue above):
 * doc's exact rotation parameters — magnitude 90deg on BOTH the row and
 * column step — make the tick's rotation depend only on
 * `(row-1)+(col-1)` (when both steps share sign) or `(row-1)-(col-1)`
 * (opposite signs), each of which takes only 5 distinct raw values over a
 * 3x3 grid (0..4, or -2..2) — and 90*4 = 360 = 90*0 (mod 360), so the two
 * EXTREME cells of whichever axis is in play alias to the SAME rotation.
 * With the same-sign parametrisation this aliases (1,1) with the key at
 * (3,3); with opposite signs it aliases (1,1), (2,2) AND the key all
 * together (the whole main diagonal, since row-1-(col-1)=0 for all three).
 * An exhaustive check over every (kShape in {1,2}) x (startShape in
 * {0,1,2}) x (rotBase in 0/90/180/270) x (both sign combinations) — 192
 * combinations total — found ZERO that avoid a full (shape, rotation)
 * collision somewhere among the key + 8 context cells: for every kShape
 * choice, either the diagonal that must carry 3 distinct shapes to
 * compensate for the aliased rotation is exactly the diagonal whose shapes
 * that kShape does NOT keep distinct. This is a genuine, load-bearing
 * incompatibility between doc's own R6 Latin-square construction and its
 * own R2 rotation-step choice for this family, independent of the already-
 * documented G-08 issue. Separately, doc's own worked M6 grid (§6) already
 * exhibits the shape half of this: (1,3), (2,2) and (3,1) are ALL "diamond,
 * tick 180" in doc's own table — a genuine triple duplicate in the
 * canonical exemplar.
 *
 * The fix used here: keep the rule taxonomy identical (R2 rotation,
 * cross-layer) but use a 45deg step magnitude instead of 90deg (still
 * within doc's R2 definition, doc 03-logical-reasoning-design.md §3: "a
 * constant angle per column (45deg, 90deg, 135deg)" — 45deg is doc's own
 * FIRST listed example, not a value this generator invented). At magnitude
 * 45, `(row-1)+(col-1)` (or the difference) spans 0..180 (or -90..90),
 * nowhere near the 360deg wraparound, so the aliasing disappears; a repeat
 * check over the same 192-combination space finds 96 (exactly half) fully
 * safe. `sampleParams` rejection-samples against that safety check
 * directly (doc 03-item-generation-pipeline.md §3.6's rejection-sampling
 * rule: reject-and-redraw within this family's own substream, never a
 * shared one).
 */
import type { Element, RuleSpec, ShapeId } from '../../spec/schema'
import { enumVal, numVal } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx } from '../compose'
import { chimera, incompleteRule, repetition } from '../distractors'
import type { Rng } from '../rng'
import { contextBlindGate, giveawayPairGate } from '../qa/contextblind'
import { copyEliminationOk, singleRuleSufficiencyOk } from '../qa/degeneracy'
import type { DistractorCandidate } from '../compose'
import { combinations4 } from '../combinatorics'
import { cellEq } from '../axes'

const SHAPE_AXIS = 'outer.shape'
const ROT_AXIS = 'inner.rotation'
const TICK_LENGTH = 30

const SHAPE_SETS = [
  ['square', 'circle', 'diamond'],
  ['circle', 'triangle', 'square'],
  ['diamond', 'circle', 'triangle'],
  ['square', 'circle', 'pentagon'],
] as const

const ROT_MAGNITUDE = 45

export interface M6Params {
  shapeSet: readonly [string, string, string]
  kShape: 1 | 2
  startShape: 0 | 1 | 2
  rotBase: number
  colSign: 1 | -1
  rowSign: 1 | -1
}

function cyclicLatin<T>(ladder: readonly T[], k: number, start: number, row: number, col: number): T {
  const idx = (((start + (col - 1) + k * (row - 1)) % 3) + 3) % 3
  return ladder[idx]
}

function rotationAt(params: Pick<M6Params, 'rotBase' | 'colSign' | 'rowSign'>, row: number, col: number): number {
  return (((params.rotBase + params.colSign * ROT_MAGNITUDE * (col - 1) + params.rowSign * ROT_MAGNITUDE * (row - 1)) % 360) + 360) % 360
}

/** doc 03-logical-reasoning-design.md §6 M6's own grid layout, in terms of a shapeSet/kShape/startShape triple: which (row,col) -> shape mapping the family uses, shared by the safety check and `valueAt`. */
function shapeAt(shapeSet: readonly [string, string, string], kShape: number, startShape: number, row: number, col: number): string {
  return cyclicLatin(shapeSet, kShape, startShape, row, col)
}

const CONTEXT_CELLS: [number, number][] = [
  [1, 1],
  [1, 2],
  [1, 3],
  [2, 1],
  [2, 2],
  [2, 3],
  [3, 1],
  [3, 2],
]

/** True iff this parameter combination produces NO (shape, rotation) coincidence among the key + 8 context cells. See the family header comment for why this can't be guaranteed by construction alone. */
function isGridSafe(params: M6Params): boolean {
  const pairs = CONTEXT_CELLS.map(([r, c]) => `${shapeAt(params.shapeSet, params.kShape, params.startShape, r, c)}|${rotationAt(params, r, c)}`)
  const keyPair = `${shapeAt(params.shapeSet, params.kShape, params.startShape, 3, 3)}|${rotationAt(params, 3, 3)}`
  return new Set(pairs).size === pairs.length && !pairs.includes(keyPair)
}

function cell(shape: string, rotation: number): Element[] {
  return [
    { type: 'shape', layer: 'outer', shape: shape as ShapeId, fill: 'outline', size: 'L', anchor: 'CTR', rotation: 0 },
    { type: 'tick', layer: 'inner', length: TICK_LENGTH, rotation: ((rotation % 360) + 360) % 360 },
  ]
}

export const LRM_2R_XLAYER: FamilyTemplate<M6Params> = {
  code: 'LRM-2R-XLAYER',
  axes: [SHAPE_AXIS, ROT_AXIS],
  domains: () => ({
    [SHAPE_AXIS]: { kind: 'unordered-enum' } as AxisDomain,
    [ROT_AXIS]: { kind: 'numeric-angle' } as AxisDomain,
  }),
  valueAt: (axis, row, col, params) => {
    if (axis === SHAPE_AXIS) return enumVal(shapeAt(params.shapeSet, params.kShape, params.startShape, row, col))
    if (axis === ROT_AXIS) return numVal(rotationAt(params, row, col))
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
      id: 'R2',
      axis: ROT_AXIS,
      direction: 'both',
      params: { base: params.rotBase, stepPerColumn: params.colSign * ROT_MAGNITUDE, stepPerRow: params.rowSign * ROT_MAGNITUDE, modulus: 360 },
      statement: `Inner tick rotation = ${params.rotBase} + ${params.colSign * ROT_MAGNITUDE}*(col-1) + ${params.rowSign * ROT_MAGNITUDE}*(row-1), mod 360.`,
    },
  ],
  radicals: { ruleCount: 2, ruleIds: ['R6', 'R2'], crossLayer: true, perceptualLoad: 1, elementTypes: 3, nearMissCount: 2 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 10 },
  distractorPlan: ['IR', 'IR', 'PM', 'RP'],
  sampleParams(rng: Rng): M6Params {
    // Rejection-sample against `isGridSafe` — see the family header note.
    // ~96/192 (exactly half) of the raw combinations are safe, so this
    // terminates in a handful of draws almost always; the cap is a hard
    // stop against a future parameter-space change silently emptying the
    // safe set.
    for (let attempt = 0; attempt < 200; attempt++) {
      const shapeSet = rng.pick(SHAPE_SETS)
      const kShape = rng.pick([1, 2] as const)
      const startShape = rng.int(0, 2) as 0 | 1 | 2
      const rotBase = rng.int(0, 7) * 45
      const colSign = rng.pick([1, -1] as const)
      const rowSign = rng.pick([1, -1] as const)
      const candidate: M6Params = { shapeSet: shapeSet as unknown as [string, string, string], kShape, startShape, rotBase, colSign, rowSign }
      if (isGridSafe(candidate)) return candidate
    }
    throw new Error('LRM-2R-XLAYER: sampleParams could not find a grid-safe combination in 200 attempts')
  },
  buildCell(values) {
    const shape = values[SHAPE_AXIS]
    const rot = values[ROT_AXIS]
    if (shape.t !== 'enum' || rot.t !== 'num') throw new Error('shape/rotation must be enum/num')
    return cell(shape.v, rot.v)
  },
  /**
   * doc's exact repaired M6 construction (fixed source positions, tried
   * first below) is verified against doc's OWN stated parameters only. For
   * other incidental draws (a different `kShape`/`startShape`/rotation
   * sign) it can fail G-08 or G-10 the same way the as-written M6 failed
   * G-08 — the fix is the same one used throughout this generator: fall
   * back to a search verified against the real gates, rather than
   * hand-deriving a second repair.
   *
   * COPY-ELIMINATION FIX (2026-08-14): that fallback used to search 4-of-8
   * WHOLE-CELL context copies first, and it succeeded every time — so every
   * item this family shipped had four distractors that were verbatim copies
   * of visible cells while the key was not, and "eliminate any option that
   * reproduces a cell you can already see" solved it outright (116 of 116
   * items measured over 12 seeds). The whole-cell stage is gone: it is a
   * strict subset of the recombination pool below, which reaches genuinely
   * novel (shape, rotation) pairings too, and G-11 is now consulted inside
   * `validSet` so a copy-only subset is rejected while there is still time
   * to pick a different one.
   */
  buildDistractors(ctx: DistractorCtx<M6Params>) {
    const keyShape = ctx.valueAt(SHAPE_AXIS, 3, 3)
    const keyRot = ctx.valueAt(ROT_AXIS, 3, 3)
    if (keyShape.t !== 'enum' || keyRot.t !== 'num') throw new Error('shape/rotation must be enum/num')

    // A: IR — stalls rotation at R3C2, shape correct.
    const rotStall = ctx.valueAt(ROT_AXIS, 3, 2)
    if (rotStall.t !== 'num') throw new Error('rotation must be num')
    const a = incompleteRule('stall:inner.rotation@R3C2', cell(keyShape.v, rotStall.v), ROT_AXIS, keyRot, rotStall)

    // C: IR — stalls shape at R3C1, rotation correct.
    const shapeStall = ctx.valueAt(SHAPE_AXIS, 3, 1)
    if (shapeStall.t !== 'enum') throw new Error('shape must be enum')
    const c = incompleteRule('stall:outer.shape@R3C1', cell(shapeStall.v, keyRot.v), SHAPE_AXIS, keyShape, shapeStall)

    // D: PM — chimera of R3C2's shape + R3C1's rotation (doc's repaired M6, §4.5).
    const dShape = ctx.valueAt(SHAPE_AXIS, 3, 2)
    const dRot = ctx.valueAt(ROT_AXIS, 3, 1)
    if (dShape.t !== 'enum' || dRot.t !== 'num') throw new Error('shape/rotation must be enum/num')
    const wrongAxesD = [...(dShape.v === keyShape.v ? [] : [SHAPE_AXIS]), ...(dRot.v === keyRot.v ? [] : [ROT_AXIS])]
    const d = chimera('chimera:{outer.shape<-R3C2,inner.rotation<-R3C1}', cell(dShape.v, dRot.v), wrongAxesD)

    // E: RP — full copy of R3C2.
    const eShape = ctx.valueAt(SHAPE_AXIS, 3, 2)
    const eRot = ctx.valueAt(ROT_AXIS, 3, 2)
    if (eShape.t !== 'enum' || eRot.t !== 'num') throw new Error('shape/rotation must be enum/num')
    const wrongAxesE = [...(eShape.v === keyShape.v ? [] : [SHAPE_AXIS]), ...(eRot.v === keyRot.v ? [] : [ROT_AXIS])]
    const e = repetition('copyCell:R3C2', cell(eShape.v, eRot.v), wrongAxesE)

    const positions = ctx.grid.map((gc) => {
      const s = ctx.valueAt(SHAPE_AXIS, gc.row, gc.col)
      const r = ctx.valueAt(ROT_AXIS, gc.row, gc.col)
      if (s.t !== 'enum' || r.t !== 'num') throw new Error('shape/rotation must be enum/num')
      return { row: gc.row, col: gc.col, shape: s.v, rot: r.v }
    })
    const contextCells = positions.map((p) => ({ elements: cell(p.shape, p.rot) }))

    const validSet = (candidates: DistractorCandidate[]): boolean => {
      if (candidates.some((cd) => cd.wrongAxes.length === 0)) return false
      if (candidates.some((cd) => cellEq({ elements: cd.elements }, ctx.keyCell))) return false
      for (let i = 0; i < candidates.length; i++)
        for (let j = i + 1; j < candidates.length; j++)
          if (cellEq({ elements: candidates[i].elements }, { elements: candidates[j].elements })) return false
      const cells = [{ elements: ctx.keyCell.elements }, ...candidates.map((x) => ({ elements: x.elements }))]
      // G-11 (qa/degeneracy.ts's copyEliminationCheck) is consulted HERE, not
      // just measured afterwards: without it this family's repair search
      // settled on 4-of-8 whole-cell context copies every single time, which
      // made "eliminate any option that reproduces a visible cell" isolate
      // the key with certainty.
      if (!copyEliminationOk(contextCells, cells, 0)) return false
      // G-18: neither the Latin square nor the rotation may pick the key out
      // on its own, or this "two-rule" item is a one-rule item wearing a
      // second rule as decoration.
      if (!singleRuleSufficiencyOk(cells, 0, ctx.axes)) return false
      return contextBlindGate(cells, 0, ctx.axes).ok && giveawayPairGate(cells, ctx.axes).ok
    }

    const docRepair = [a, c, d, e]
    if (validSet(docRepair)) return docRepair

    /**
     * Fallback: search every (shape value, rotation value) RECOMBINATION,
     * not just the 8 whole-cell copies. The pool deliberately includes the
     * key's OWN rotation and the key's OWN shape (just never both at once):
     *
     *  - novelty. The 3 shape values x ~5 realised rotation values give ~15
     *    distinct cells, of which only 9 are realised on the grid, so a
     *    recombination is frequently a figure that appears NOWHERE — exactly
     *    the "applied the rule wrongly and got something new" near-miss the
     *    copy-elimination invariant needs, and something a 4-of-8 whole-cell
     *    search can never produce.
     *  - rule-subset sufficiency. If no distractor may carry the key's own
     *    rotation, then knowing only the rotation rule identifies the key
     *    outright and the Latin square does no work. Measured before this
     *    change: the rotation rule alone isolated the key in 53 of 116 items.
     *
     * A pool entry that does happen to coincide with a context cell keeps
     * the honest `copyCell:RxCy` mechanism label rather than being renamed a
     * recombination.
     */
    const shapeValues = [...new Set([...positions.map((p) => p.shape), keyShape.v])]
    const rotValues = [...new Set([...positions.map((p) => p.rot), keyRot.v])]
    const pool = shapeValues
      .flatMap((s) => rotValues.map((r) => ({ shape: s, rot: r })))
      .filter((p) => !(p.shape === keyShape.v && p.rot === keyRot.v))
    const labels: Array<'IR' | 'PM' | 'RP'> = ['IR', 'IR', 'PM', 'RP']
    for (const chosen of combinations4(pool)) {
      const candidates: DistractorCandidate[] = chosen.map((p, i) => {
        const wrongAxes = [...(p.shape === keyShape.v ? [] : [SHAPE_AXIS]), ...(p.rot === keyRot.v ? [] : [ROT_AXIS])]
        const at = positions.find((q) => q.shape === p.shape && q.rot === p.rot)
        const mechanism = at ? `copyCell:R${at.row}C${at.col}` : `recombine:{outer.shape=${p.shape},inner.rotation=${p.rot}}`
        const elements = cell(p.shape, p.rot)
        return labels[i] === 'RP' ? repetition(mechanism, elements, wrongAxes) : chimera(mechanism, elements, wrongAxes)
      })
      if (validSet(candidates)) return candidates
    }
    throw new Error(`LRM-2R-XLAYER: no distractor construction cleared G-08/G-10/G-11 for params ${JSON.stringify(ctx.params)}`)
  },
  nonCardinalAsymmetricRotation: () => true, // 45deg step on a tick (asymmetric element) — doc 03-logical-reasoning-design.md §4.4's non-cardinal bump applies, same as LRM-ROT.
  structuralExtra: (params: M6Params) => ({ startShape: params.startShape, rotBase: params.rotBase, colSign: params.colSign, rowSign: params.rowSign }),
}
