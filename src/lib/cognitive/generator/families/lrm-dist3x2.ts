/**
 * LRM-DIST3X2 — M3's family. Doc 03-logical-reasoning-design.md §6 M3:
 * distribution of three on TWO independent attributes (shape, fill), each a
 * cyclic Latin square `value(row,col) = ladder[(start + (col-1) + k*(row-1))
 * mod 3]`. Doc's own worked grid is reproduced exactly by `kShape=2, kFill=1,
 * start=0` on both — verified by hand against doc 03-logical-reasoning-
 * design.md §6 M3's table while designing this family.
 *
 * UNREGISTERED (see `families/index.ts`) — THIS FAMILY CANNOT SATISFY G-11,
 * AND THE REASON IS A THEOREM ABOUT ITS SHAPE, NOT A BUG IN ITS CODE.
 *
 * G-11 (`qa/degeneracy.ts`'s `copyEliminationCheck`) requires that at least
 * two of the five options survive "eliminate every option that reproduces a
 * visible cell". Measured after the gate was made real: LRM-DIST3X2 fails it
 * on 120 of 120 draws. No distractor search can fix that, because:
 *
 *   1. A cell in this family is fully described by two axes, each with
 *      exactly three values, and nothing else varies. So there are 3 x 3 = 9
 *      distinguishable cells in total.
 *   2. The grid has 9 positions. `CELL_DUPLICATE` (ruleCount >= 2) forbids
 *      any two of them coinciding. By pigeonhole the 9 positions therefore
 *      realise all 9 (shape, fill) pairs — 8 of them visible, the 9th being
 *      the key. That is the family's own Graeco-Latin proof, restated.
 *   3. Hence EVERY constructible option is either one of the 8 visible pairs
 *      (a verbatim copy) or the key's pair. Two options cannot both be the
 *      key's pair (`OPTION_HOMOGENEITY`). So exactly one option can ever be a
 *      non-copy, and it is always the key.
 *
 * The escape hatches are all closed too, and it is worth writing down why,
 * because "just widen the pool" is the obvious wrong answer:
 *
 *   - Loosening orthogonality does not help. Over Z3 two cyclic Latin
 *     squares are either orthogonal (9 distinct pairs, the case above) or
 *     rank-deficient (3 distinct pairs, fill a pure function of shape — the
 *     second rule carries no information, and six cells become duplicates).
 *     There is no middle case.
 *   - Adding a THIRD Latin square (e.g. on size) does not help either: a
 *     complete set of MOLS of order 3 has only two squares, so a third
 *     attribute of this kind is necessarily correlated with one of the
 *     first two.
 *   - Drawing a distractor from OUTSIDE the item's vocabulary (a fourth
 *     shape, or a size no cell uses) is not a fix but a second leak of the
 *     same kind: it creates a new one-member eliminable class, so "eliminate
 *     copies, then eliminate the odd one out" still lands on the key.
 *
 * What a working replacement looks like is already in the tree: give the
 * second or third axis a value space LARGER than the grid can exhaust — a
 * count progression (`lrm-3r-dist.ts`, count 1..3 over 3 shapes x 3 fills =
 * 27 combinations, 9 used) or a rotation progression (`lrm-3r-xlayer.ts`,
 * 8 angles). Both pass G-11 comfortably. Rebuilding M3 that way changes what
 * the family IS (its rule ids, and so its predicted b), which is a design
 * decision, not a defect fix — so this file is left intact and unregistered
 * rather than quietly mutated into a different family. The `hard` band it
 * used to occupy is still covered by LRM-2R-XLAYER (+0.8), LRM-XOR-XLAYER
 * (+0.9) and LRM-3R-DIST (+1.1).
 *
 * FINDING: `kShape` and `kFill` must be DIFFERENT non-zero offsets mod 3.
 * `k=0` degenerates to a constant-per-row square (doc 03-item-generation-
 * pipeline.md §3.5's LATIN_TRIVIAL). `kShape === kFill` (both nonzero)
 * produces a valid Latin square on EACH attribute individually, but the two
 * attributes become perfectly correlated — every cell showing a given shape
 * always shows the same fill, so fill carries no independent information
 * and the item is not really testing two rules. For n=3 (prime), any two
 * DISTINCT nonzero offsets are automatically orthogonal (the classical
 * Graeco-Latin-square construction over GF(3)), which is why the incidental
 * space below only ever pairs {1,2} — never {1,1} or {2,2}.
 */
import type { Element, Fill, RuleSpec, ShapeId } from '../../spec/schema'
import { enumVal } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx } from '../compose'
import { chimera, repetition } from '../distractors'
import type { Rng } from '../rng'
import { contextBlindGate, giveawayPairGate } from '../qa/contextblind'
import { combinations4 } from '../combinatorics'

const SHAPE_AXIS = 'outer.shape'
const FILL_AXIS = 'outer.fill'

const SHAPE_SETS = [
  ['circle', 'square', 'triangle'],
  ['circle', 'triangle', 'diamond'],
  ['square', 'diamond', 'pentagon'],
  ['circle', 'square', 'pentagon'],
] as const
const FILL_LADDER = ['outline', 'solid', 'hatched'] as const

export interface M3Params {
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

function shapeFillCell(shape: string, fill: string): Element[] {
  return [{ type: 'shape', layer: 'outer', shape: shape as ShapeId, fill: fill as Fill, size: 'M', anchor: 'CTR', rotation: 0 }]
}

export const LRM_DIST3X2: FamilyTemplate<M3Params> = {
  code: 'LRM-DIST3X2',
  axes: [SHAPE_AXIS, FILL_AXIS],
  domains: () => ({
    [SHAPE_AXIS]: { kind: 'unordered-enum' } as AxisDomain,
    [FILL_AXIS]: { kind: 'unordered-enum', ladder: FILL_LADDER.map(enumVal) } as AxisDomain,
  }),
  valueAt: (axis, row, col, params) => {
    if (axis === SHAPE_AXIS) return enumVal(cyclicLatin(params.shapeSet, params.kShape, params.startShape, row, col))
    if (axis === FILL_AXIS) return enumVal(cyclicLatin(FILL_LADDER, params.kFill, params.startFill, row, col))
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
  ],
  radicals: { ruleCount: 2, ruleIds: ['R6', 'R6'], crossLayer: false, perceptualLoad: 1, elementTypes: 3, nearMissCount: 2 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 },
  distractorPlan: ['IR', 'IR', 'PM', 'RP'],
  sampleParams(rng: Rng): M3Params {
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
    if (shape.t !== 'enum' || fill.t !== 'enum') throw new Error('shape/fill must be enum')
    return shapeFillCell(shape.v, fill.v)
  },
  /**
   * FINDING: doc 03-logical-reasoning-design.md §6 M3's options B/C are
   * framed as "recombinations" (key's shape + a neighbour's fill, and vice
   * versa). But this family is a FULLY ORTHOGONAL 3x3 Graeco-Latin square —
   * both attributes together realise all 3x3=9 possible (shape, fill) pairs
   * across the 9 cells, each exactly once. That means ANY recombination of
   * a real shape value with a real fill value is mathematically GUARANTEED
   * to reconstruct some OTHER real cell's exact pairing (there is no 10th,
   * "genuinely novel" wrong pairing available in a 3x3 attribute space).
   * Concretely: doc's own option B ("solid circle") is not just "shape
   * correct, fill wrong" in isolation — it is an exact match for R1C1 in
   * doc's own worked table, whether doc intended that or not. Distinct
   * "recombination" and "whole-cell-copy" distractors are therefore NOT
   * independently constructible here — attempting it (an earlier version of
   * this function did) intermittently collides two "different" mechanisms
   * on the identical resulting cell, which `gateDistractor` correctly
   * rejects as DUPLICATE_OPTION. The fix: select four DISTINCT context-cell
   * POSITIONS directly. Distinct positions have distinct pairs by the same
   * bijection argument, which trivially guarantees no duplicate among the
   * four distractors or against the key (a fifth, different position).
   */
  /**
   * SECOND FINDING (context-blind vs. giveaway-pair tension): the naive fix
   * for G-08 — pick all 4 distractor sources from the 4 context cells that
   * differ from the key on BOTH axes — trips G-10 instead. With only 2
   * shape values and 2 fill values left once the key's own values are
   * excluded, those 4 "differs on both" cells are EXACTLY the 2x2 grid of
   * remaining combinations, which necessarily contains two pairs that are
   * perfect complements of each other on every axis — and because the key
   * shares NEITHER axis with any of them, the key becomes one of the
   * "eliminable others" G-10 exists to catch. Fixing G-08 in isolation
   * created a G-10 failure: the two gates pull in opposite directions for a
   * fully-orthogonal two-axis design. Rather than hand-solve the combined
   * constraint, this picks a 4-of-8 subset of context cells by brute force
   * (C(8,4)=70, trivial) and keeps the first one — in a fixed, seed-
   * independent preference order — that clears BOTH gates. This is the same
   * two gates the rest of the pipeline runs; nothing here is a relaxed or
   * different check.
   */
  buildDistractors(ctx: DistractorCtx<M3Params>) {
    const keyShape = ctx.valueAt(SHAPE_AXIS, 3, 3)
    const keyFill = ctx.valueAt(FILL_AXIS, 3, 3)
    if (keyShape.t !== 'enum' || keyFill.t !== 'enum') throw new Error('shape/fill must be enum')

    const cellAt = (row: number, col: number) => {
      const shape = ctx.valueAt(SHAPE_AXIS, row, col)
      const fill = ctx.valueAt(FILL_AXIS, row, col)
      if (shape.t !== 'enum' || fill.t !== 'enum') throw new Error('shape/fill must be enum')
      return { row, col, shape: shape.v, fill: fill.v, elements: shapeFillCell(shape.v, fill.v) }
    }
    const positions = ctx.grid.map((c) => cellAt(c.row, c.col)).sort((a, b) => a.row - b.row || a.col - b.col)

    const labels: Array<'IR' | 'PM' | 'RP'> = ['IR', 'IR', 'PM', 'RP']
    const buildFrom = (chosen: typeof positions) =>
      chosen.map((c, i) => {
        const wrongAxes = [...(c.shape === keyShape.v ? [] : [SHAPE_AXIS]), ...(c.fill === keyFill.v ? [] : [FILL_AXIS])]
        const mechanism = `copyCell:R${c.row}C${c.col}`
        return labels[i] === 'RP' ? repetition(mechanism, c.elements, wrongAxes) : chimera(mechanism, c.elements, wrongAxes)
      })

    for (const chosen of combinations4(positions)) {
      const candidates = buildFrom(chosen)
      const cells = [{ elements: ctx.keyCell.elements }, ...candidates.map((c) => ({ elements: c.elements }))]
      if (contextBlindGate(cells, 0, ctx.axes).ok && giveawayPairGate(cells, ctx.axes).ok) {
        return candidates
      }
    }
    throw new Error(`LRM-DIST3X2: no 4-of-8 context-cell subset cleared both G-08 and G-10 for params ${JSON.stringify(ctx.params)}`)
  },
  nonCardinalAsymmetricRotation: () => false,
  structuralExtra: (params: M3Params) => ({ startShape: params.startShape, startFill: params.startFill }),
}
