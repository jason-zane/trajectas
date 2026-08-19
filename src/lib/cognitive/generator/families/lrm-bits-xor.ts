/**
 * LRM-BITS-XOR — one hard rule on a heavy surface: R7 (symmetric difference)
 * on the black positions of a 3×3 bit-grid, row-wise (col 3 = col 1 XOR
 * col 2). Build-plan 2026-08-19-cognitive-v2-build-plan.md §4; the on-ramp
 * to LRM-BITS-2OP so the bit-grid format is not first met at the ceiling.
 *
 * WHY THIS FAMILY EXISTS. The Mensa Norway benchmark (2026-08-19-mensa-
 * norway-benchmark.md §5.1) found the top third of a mature matrix test gets
 * its difficulty from PERCEPTUAL DECOMPOSITION — bit-grids, stroke figures,
 * positional layouts — not from more rules; BOLT (Schroeders & Walter 2026,
 * N = 7,150) found the same two determinants formally: binary-operation
 * count and perceptual organisation. Our bank had neither surface. This
 * family carries the same R7 the bar families carry, on nine positions
 * instead of four bars: same radical, heavier load (perceptualLoad 2).
 *
 * CONSTRUCTION. Each row draws its own operand pair from all nine positions
 * — |c1| = |c2| = 3 with exactly one shared position — so the row result is
 * always 4 positions and, because the overlap is exactly one, XOR ≠ union ≠
 * difference in every row: Level A verifies R7 as the unique row reading.
 * (An earlier draft reused ONE operand pair for all three rows; every row was
 * then identical, the key equalled two visible cells, and nothing could pass
 * G-12 — the "0/160 accepted" the first review reported.)
 *
 * OPTION SET (single hard axis, six options; every distractor is a specific
 * wrong application of the rule — the plan is `distractorPlan` below):
 *   key   XOR                          (4 positions)
 *   IR    XOR minus one position       (3)   — the incomplete result
 *   WR-a  XOR minus one, plus the shared position (4)   — "the element both
 *         operands have belongs in the result": the classic XOR/OR confusion
 *         made local, so its cardinality stays in vocabulary
 *   WR-b  the same, dropping a different position (4)
 *   WR-c  the same, dropping a third position (4)
 *   RP    a verbatim copy of R3C1        (3)   — perseveration on an operand
 * Cardinalities {4,3,4,4,4,3}: G-09 spread 1, key not a sole extremum. Every
 * count (3, 4) and every position each distractor uses is realised in the
 * grid, so G-19's out-of-vocabulary cue has nothing to bite on. The key has
 * four positions {A,B,C,D}; IR drops one, WR-a/b/c each drop different ones,
 * leaving all four key positions dropped exactly once across IR and WRs.
 * Per-position modal (>3 of 6 = at least 4 of 6): at most three positions
 * appear in > 3 options, so the modal doesn't uniquely identify the key.
 * All options distinct on the axis, so the centroid is well-separated.
 * RP is the one copy; key + IR + three WRs are non-copies (G-11 ≥ 2).
 *
 * Predicted b (difficulty.ts): −2.0 + 1.6 (R7) + 0.3·2 (perceptualLoad) =
 * +0.20, moderate.
 */
import type { Element, RuleSpec } from '../../spec/schema'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx, DistractorCandidate } from '../compose'
import type { Rng } from '../rng'
import { contextBlindGate, giveawayPairGate } from '../qa/contextblind'
import { copyEliminationOk, eliminationResistanceOk, keyBulkExtremumCheck, optionComplexitySpreadCheck } from '../qa/degeneracy'
import { cellEq } from '../axes'
import { ALL_POSITIONS, BLACK_AXIS, bitgridCell, columnOperatorCoincidence, fromSetVal, interSet, minusSet, posSetVal, sameSet, sampleOperandPair, sortPos, unionSet, uniquelySolvable, xorSet, type Pos } from './bitgrid'

export interface BitsXorRow {
  c1: Pos[]
  c2: Pos[]
}
export interface BitsXorParams {
  /** One operand pair per grid row, index 0..2. */
  rows: [BitsXorRow, BitsXorRow, BitsXorRow]
}

const OPERAND_SIZE = 3
const OVERLAP = 1

function resultOf(row: BitsXorRow): Pos[] {
  return xorSet(row.c1, row.c2)
}

function cellFor(black: readonly Pos[]): Element[] {
  return bitgridCell(black, [])
}

/**
 * Rejection sampling for a grid that is well-formed BEFORE distractors are
 * considered: the eight visible cells pairwise distinct as sets, the key
 * (row 3's result) distinct from every visible cell. Bounded loop; the draw
 * is cheap and the constraints are loose.
 */
function sampleRows(rng: Rng): BitsXorParams['rows'] {
  for (let attempt = 0; attempt < 200; attempt++) {
    const rows = [0, 1, 2].map(() => {
      const { a, b } = sampleOperandPair(rng, ALL_POSITIONS, OPERAND_SIZE, OVERLAP)
      return { c1: a, c2: b }
    }) as BitsXorParams['rows']
    const key = resultOf(rows[2])
    const visible: Pos[][] = []
    for (let r = 0; r < 3; r++) {
      visible.push(rows[r].c1, rows[r].c2)
      if (r < 2) visible.push(resultOf(rows[r]))
    }
    let ok = true
    for (let i = 0; i < visible.length && ok; i++) {
      if (sameSet(visible[i], key)) ok = false
      for (let j = i + 1; j < visible.length && ok; j++) if (sameSet(visible[i], visible[j])) ok = false
    }
    // No rival column-operator reading (see columnOperatorCoincidence), and
    // — the general form of the same guard — Level A must find R7 the unique
    // reading on the grid this draw would produce (see uniquelySolvable).
    const at = (c: 1 | 2 | 3, r: 1 | 2 | 3): readonly Pos[] => (c === 1 ? rows[r - 1].c1 : c === 2 ? rows[r - 1].c2 : resultOf(rows[r - 1]))
    if (ok && columnOperatorCoincidence(at)) ok = false
    if (ok) {
      const cells = ([1, 2, 3] as const).flatMap((r) => ([1, 2, 3] as const).filter((c) => !(r === 3 && c === 3)).map((c) => ({ row: r, col: c, elements: cellFor(at(c, r)) })))
      if (!uniquelySolvable(cells, [BLACK_AXIS], { [BLACK_AXIS]: { kind: 'set' } as AxisDomain })) ok = false
    }
    if (ok) return rows
  }
  throw new Error('LRM-BITS-XOR: could not sample a distinct grid in 200 attempts')
}

export const LRM_BITS_XOR: FamilyTemplate<BitsXorParams> = {
  code: 'LRM-BITS-XOR',
  axes: [BLACK_AXIS],
  domains: () => ({ [BLACK_AXIS]: { kind: 'set' } as AxisDomain }),
  valueAt: (axis, row, col, params) => {
    if (axis !== BLACK_AXIS) throw new Error(`unknown axis ${axis}`)
    const r = params.rows[row - 1]
    if (col === 1) return posSetVal(r.c1)
    if (col === 2) return posSetVal(r.c2)
    return posSetVal(resultOf(r))
  },
  ruleSpecs: (): RuleSpec[] => [
    {
      id: 'R7',
      axis: BLACK_AXIS,
      direction: 'row_operator',
      params: { op: 'symdiff' },
      statement: 'The black squares in the third grid of each row are exactly those that appear in one, but not both, of the first two grids (their symmetric difference).',
    },
  ],
  // perceptualLoad 2: nine positions to hold instead of four bars — the
  // surface IS the load (BOLT's second determinant). elementTypes 2 is the
  // schema's floor; the visual vocabulary here is two states (empty/black).
  radicals: { ruleCount: 1, ruleIds: ['R7'], crossLayer: false, perceptualLoad: 2, elementTypes: 2, nearMissCount: 2 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 },
  distractorPlan: ['IR', 'WR', 'WR', 'WR', 'RP'],
  sampleParams(rng: Rng): BitsXorParams {
    return { rows: sampleRows(rng) }
  },
  buildCell(values) {
    return cellFor(fromSetVal(values[BLACK_AXIS]))
  },
  buildDistractors(ctx: DistractorCtx<BitsXorParams>) {
    const key = fromSetVal(ctx.valueAt(BLACK_AXIS, 3, 3))
    const c1 = fromSetVal(ctx.valueAt(BLACK_AXIS, 3, 1))
    const c2 = fromSetVal(ctx.valueAt(BLACK_AXIS, 3, 2))
    const shared = interSet(c1, c2) // exactly one position by construction
    const contextCells = ctx.grid.map((gc) => ({ elements: gc.elements }))

    const mk = (black: readonly Pos[], label: 'IR' | 'WR' | 'PM' | 'RP', mechanism: string): DistractorCandidate => ({
      elements: cellFor(black),
      label,
      mechanism,
      wrongAxes: sameSet(black, key) ? [] : [BLACK_AXIS],
    })
    const validSet = (cands: DistractorCandidate[]): boolean => {
      if (cands.some((c) => c.wrongAxes.length === 0)) return false
      if (cands.some((c) => cellEq({ elements: c.elements }, ctx.keyCell))) return false
      for (let i = 0; i < cands.length; i++) for (let j = i + 1; j < cands.length; j++) if (cellEq({ elements: cands[i].elements }, { elements: cands[j].elements })) return false
      const cells = [{ elements: ctx.keyCell.elements }, ...cands.map((c) => ({ elements: c.elements }))]
      if (optionComplexitySpreadCheck(cells, false).status !== 'pass') return false
      if (keyBulkExtremumCheck(cells, 0).status !== 'pass') return false
      if (!copyEliminationOk(contextCells, cells, 0)) return false
      if (!eliminationResistanceOk(contextCells, cells, 0, ctx.axes)) return false
      if (!contextBlindGate(cells, 0, ctx.axes).ok) return false
      return giveawayPairGate(cells, ctx.axes).ok
    }

    // Deterministic search over the plan's free choices (N=6, so 5 distractors):
    // IR drops one key position, WRs drop the other three (one each), RP copies
    // an operand. First set to clear every gate wins; no rng — the plan is a
    // pure function of the composed item (doc §3.6 determinism).
    for (const copyOf of [c1, c2]) {
      const copyMech = sameSet(copyOf, c1) ? 'copyCell:R3C1' : 'copyCell:R3C2'
      for (const irDrop of key) {
        // IR drops irDrop; WRs drop the three other key positions
        const wrDrops = key.filter((p) => p !== irDrop).sort((a, b) => a - b)
        const ir = mk(minusSet(key, [irDrop]), 'IR', `incomplete:xor_minus_${irDrop}`)
        const wrA = mk(unionSet(minusSet(key, [wrDrops[0]]), shared), 'WR', `wrongRule:shared_kept_drop_${wrDrops[0]}`)
        const wrB = mk(unionSet(minusSet(key, [wrDrops[1]]), shared), 'WR', `wrongRule:shared_kept_drop_${wrDrops[1]}`)
        const wrC = mk(unionSet(minusSet(key, [wrDrops[2]]), shared), 'WR', `wrongRule:shared_kept_drop_${wrDrops[2]}`)
        const rp = mk(copyOf, 'RP', copyMech)
        const cands = [ir, wrA, wrB, wrC, rp]
        if (validSet(cands)) return cands
      }
    }

    // Last resort: any five distinct in-vocabulary sets built from the row's
    // own material (subsets of the result, result-with-shared swaps, operand
    // copies, other rows' cells), labelled by how they were made.
    const pool: Array<{ black: Pos[]; label: 'IR' | 'WR' | 'RP' | 'PM'; mech: string }> = []
    for (const drop of key) pool.push({ black: minusSet(key, [drop]), label: 'IR', mech: `incomplete:xor_minus_${drop}` })
    for (const a of key) pool.push({ black: unionSet(minusSet(key, [a]), shared), label: 'WR', mech: `wrongRule:shared_kept_drop_${a}` })
    pool.push({ black: c1, label: 'RP', mech: 'copyCell:R3C1' }, { black: c2, label: 'RP', mech: 'copyCell:R3C2' })
    for (const gc of ctx.grid) pool.push({ black: fromSetVal(ctx.valueAt(BLACK_AXIS, gc.row, gc.col)), label: 'PM', mech: `copyCell:R${gc.row}C${gc.col}` })
    const uniq: typeof pool = []
    for (const p of pool) if (!uniq.some((u) => sameSet(u.black, p.black)) && !sameSet(p.black, key)) uniq.push(p)
    for (let i = 0; i < uniq.length; i++)
      for (let j = i + 1; j < uniq.length; j++)
        for (let k = j + 1; k < uniq.length; k++)
          for (let l = k + 1; l < uniq.length; l++)
            for (let m = l + 1; m < uniq.length; m++) {
              const cands = [uniq[i], uniq[j], uniq[k], uniq[l], uniq[m]].map((p) => mk(p.black, p.label, p.mech))
              if (validSet(cands)) return cands
            }
    throw new Error(`LRM-BITS-XOR: no distractor construction cleared the gates for rows ${JSON.stringify(ctx.params.rows)}`)
  },
  nonCardinalAsymmetricRotation: () => false,
  // The operand sets ARE the structure: two items with different operands are
  // different items, not relabellings of one another.
  structuralExtra: (params: BitsXorParams) => ({ rows: params.rows.map((r) => ({ c1: sortPos(r.c1), c2: sortPos(r.c2) })) }),
}
