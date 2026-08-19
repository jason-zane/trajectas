/**
 * LRM-BITS-2OP — the ceiling family: two comparably hard Boolean rules on the
 * two layers of one 3×3 bit-grid, cross-layer, row-wise. Build-plan
 * 2026-08-19-cognitive-v2-build-plan.md §4; precedent BOLT (Schroeders &
 * Walter 2026): the number of BINARY operations is the primary driver of
 * matrix difficulty, and perceptual organisation the second.
 *
 *   outer.black   — R7 symmetric difference: col 3 = col 1 XOR col 2
 *   outer.hatched — R4 union:                col 3 = col 1 ∪   col 2
 *
 * LAYOUT. Every item partitions the nine positions into a BLACK DOMAIN of
 * five and a HATCHED DOMAIN of four (params.domainBlack / domainHatched,
 * drawn per item). All black sets — grid, key, every distractor — live in
 * the black domain; all hatched sets in the hatched domain. Disjointness of
 * black and hatched in every cell and every option is therefore true by
 * construction, not by checking (the schema's refinement still enforces it).
 * The fixed domains are a constant layout, like fixed anchor positions —
 * they carry no rule and Level A finds none on them.
 *
 * Black operands: |c1| = |c2| = 3, sharing exactly one position → XOR = 4
 * (the domain minus the shared position); XOR ≠ union ≠ difference in every
 * row, so R7 is the unique reading. Hatched operands: |c1| = |c2| = 2,
 * sharing one → union = 3 (the domain minus one position); union ≠ XOR (2)
 * ≠ difference (1), so R4 is the unique reading. Rows are drawn so that the
 * three "missing" hatched positions differ, which makes every hatched-domain
 * position appear hatched in at least two rows — needed below.
 *
 * OPTION SET (N=6, six options). Both rules are hard, so there are NO cheap
 * axes (G-20 skips) and G-18 applies to both: the key's black must be held
 * by ≥ 2 options and so must its hatched. Write K/H for the key's sets, X = K
 * minus s (one position dropped), Y = X plus x₃ (the shared black position of
 * row 3), W = H minus h:
 *
 *     key   (K, H)                complexity 4+3 = 7
 *     A0    (X, H)   IR black     3+3 = 6   incomplete XOR
 *     0B    (K, W)   WR hatched   4+2 = 6   XOR-instead-of-union when h = the
 *                                          shared hatched position (W is then
 *                                          exactly the operands' XOR); else the
 *                                          incomplete union
 *     AB    (X, W)   PM           3+2 = 5   chimera of the two errors
 *     A′0   (Y, H)   WR black     4+3 = 7   the shared black position kept
 *     B″B   (Y, W)   PM           4+2 = 6   both errors combined
 *
 * Analysis for N=6 (modal majority >3 of 6 = at least 4):
 *   - G-18: black correct in {key, 0B, A′0} = 3; hatched correct in {key,
 *     A0, A′0} = 3 (both >= 2 ✓).
 *   - G-08′ modal: black positions K, X, Y each in 2 options (not majority);
 *     hatched positions H, W each in 3 options (not majority). No position
 *     reaches > 3 of 6, so no modal composition uniquely identifies key.
 *   - Centroid (axis-wise 0/1 distance): no single option uniquely closest.
 *   - G-09: complexities {7,6,6,5,7,6}, spread 2, key shares maximum with
 *     A′0 (not alone ✓).
 *   - G-10: as before, (Y, H) shares hatched axis value with A0, preventing
 *     the giveaway between A0/0B. The new (Y, W) combines the cross-layer
 *     errors but shares black with A′0 (preventing a second giveaway pair).
 *   - G-19: all counts and positions realised in grid; no option out of
 *     vocabulary.
 *
 * Predicted b (difficulty.ts): −2.0 + 1.6 (R7) + 0.8 (R4) + 0.5 (two rules)
 * + 0.5 (cross-layer) + 0.3·2 (perceptualLoad) = +2.00, very hard — the
 * ceiling the first pilot form did not have. This is the one family that
 * reaches the very-hard band after the cheap-rule discount, and it does so
 * through two hard rules, not through cheap ones.
 */
import type { Element, RuleSpec } from '../../spec/schema'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx, DistractorCandidate } from '../compose'
import type { Rng } from '../rng'
import { contextBlindGate, giveawayPairGate } from '../qa/contextblind'
import { copyEliminationOk, eliminationResistanceOk, keyBulkExtremumCheck, optionComplexitySpreadCheck, singleRuleSufficiencyOk } from '../qa/degeneracy'
import { cellEq } from '../axes'
import { ALL_POSITIONS, BLACK_AXIS, HATCHED_AXIS, bitgridCell, columnOperatorCoincidence, fromSetVal, interSet, minusSet, posSetVal, sameSet, sampleOperandPair, sortPos, unionSet, uniquelySolvable, xorSet, type Pos } from './bitgrid'

export interface Bits2OpRow {
  c1b: Pos[]
  c2b: Pos[]
  c1h: Pos[]
  c2h: Pos[]
}
export interface Bits2OpParams {
  domainBlack: Pos[]
  domainHatched: Pos[]
  rows: [Bits2OpRow, Bits2OpRow, Bits2OpRow]
}

const BLACK_DOMAIN_SIZE = 5
const BLACK_OPERAND = 3
const HATCHED_OPERAND = 2

function blackOf(row: Bits2OpRow): Pos[] {
  return xorSet(row.c1b, row.c2b)
}
function hatchedOf(row: Bits2OpRow): Pos[] {
  return unionSet(row.c1h, row.c2h)
}
function cellFor(black: readonly Pos[], hatched: readonly Pos[]): Element[] {
  return bitgridCell(black, hatched)
}
function sameCell(a: { b: readonly Pos[]; h: readonly Pos[] }, b: { b: readonly Pos[]; h: readonly Pos[] }): boolean {
  return sameSet(a.b, b.b) && sameSet(a.h, b.h)
}

function sampleParams(rng: Rng): Bits2OpParams {
  for (let attempt = 0; attempt < 2000; attempt++) {
    const shuffled = rng.shuffle([...ALL_POSITIONS])
    const domainBlack = sortPos(shuffled.slice(0, BLACK_DOMAIN_SIZE))
    const domainHatched = sortPos(shuffled.slice(BLACK_DOMAIN_SIZE))
    const rows = [0, 1, 2].map(() => {
      const b = sampleOperandPair(rng, domainBlack, BLACK_OPERAND, 1)
      const h = sampleOperandPair(rng, domainHatched, HATCHED_OPERAND, 1)
      return { c1b: b.a, c2b: b.b, c1h: h.a, c2h: h.b }
    }) as Bits2OpParams['rows']
    // The three rows' unions must miss three DIFFERENT hatched positions, so
    // every hatched-domain position is hatched somewhere in the grid: the
    // fallback pool's swap variants use row 3's missing position, and G-19
    // needs it seen; it also keeps the hatched layer visibly varied.
    const missing = rows.map((r) => minusSet(domainHatched, hatchedOf(r)))
    if (missing.some((m) => m.length !== 1)) continue
    if (new Set(missing.map((m) => m[0])).size !== 3) continue
    // Cells pairwise distinct on (black, hatched); key distinct from all.
    const key = { b: blackOf(rows[2]), h: hatchedOf(rows[2]) }
    const visible: Array<{ b: Pos[]; h: Pos[] }> = []
    for (let r = 0; r < 3; r++) {
      visible.push({ b: rows[r].c1b, h: rows[r].c1h }, { b: rows[r].c2b, h: rows[r].c2h })
      if (r < 2) visible.push({ b: blackOf(rows[r]), h: hatchedOf(rows[r]) })
    }
    let ok = true
    for (let i = 0; i < visible.length && ok; i++) {
      if (sameCell(visible[i], key)) ok = false
      for (let j = i + 1; j < visible.length && ok; j++) if (sameCell(visible[i], visible[j])) ok = false
    }
    // No rival column-operator reading on EITHER axis (see
    // columnOperatorCoincidence) — Level A would throw, not reject.
    const blackAt = (c: 1 | 2 | 3, r: 1 | 2 | 3): readonly Pos[] => (c === 1 ? rows[r - 1].c1b : c === 2 ? rows[r - 1].c2b : blackOf(rows[r - 1]))
    const hatchedAt = (c: 1 | 2 | 3, r: 1 | 2 | 3): readonly Pos[] => (c === 1 ? rows[r - 1].c1h : c === 2 ? rows[r - 1].c2h : hatchedOf(rows[r - 1]))
    if (ok && (columnOperatorCoincidence(blackAt) || columnOperatorCoincidence(hatchedAt))) ok = false
    // …and, in general form, Level A must find R7 and R4 the unique readings
    // on the grid this draw would produce (see uniquelySolvable): with a five-
    // and a four-position domain the accidental-regularity probes fire on a
    // real fraction of draws.
    if (ok) {
      const cells = ([1, 2, 3] as const).flatMap((r) => ([1, 2, 3] as const).filter((c) => !(r === 3 && c === 3)).map((c) => ({ row: r, col: c, elements: cellFor(blackAt(c, r), hatchedAt(c, r)) })))
      if (!uniquelySolvable(cells, [BLACK_AXIS, HATCHED_AXIS], { [BLACK_AXIS]: { kind: 'set' } as AxisDomain, [HATCHED_AXIS]: { kind: 'set' } as AxisDomain })) ok = false
    }
    if (ok) return { domainBlack, domainHatched, rows }
  }
  throw new Error('LRM-BITS-2OP: could not sample a well-formed grid in 2000 attempts')
}

export const LRM_BITS_2OP: FamilyTemplate<Bits2OpParams> = {
  code: 'LRM-BITS-2OP',
  axes: [BLACK_AXIS, HATCHED_AXIS],
  domains: () => ({ [BLACK_AXIS]: { kind: 'set' } as AxisDomain, [HATCHED_AXIS]: { kind: 'set' } as AxisDomain }),
  valueAt: (axis, row, col, params) => {
    const r = params.rows[row - 1]
    if (axis === BLACK_AXIS) return posSetVal(col === 1 ? r.c1b : col === 2 ? r.c2b : blackOf(r))
    if (axis === HATCHED_AXIS) return posSetVal(col === 1 ? r.c1h : col === 2 ? r.c2h : hatchedOf(r))
    throw new Error(`unknown axis ${axis}`)
  },
  ruleSpecs: (): RuleSpec[] => [
    {
      id: 'R7',
      axis: BLACK_AXIS,
      direction: 'row_operator',
      params: { op: 'symdiff' },
      statement: 'The black squares in the third grid of each row are exactly those that appear in one, but not both, of the first two grids (their symmetric difference).',
    },
    {
      id: 'R4',
      axis: HATCHED_AXIS,
      direction: 'row_operator',
      params: { op: 'union' },
      statement: 'The hatched squares in the third grid of each row are all those that appear in either of the first two grids (their union).',
    },
  ],
  // elementTypes 3: empty / black / hatched are the three visual states the
  // candidate must keep apart. perceptualLoad 2: nine positions, two layers.
  radicals: { ruleCount: 2, ruleIds: ['R7', 'R4'], crossLayer: true, perceptualLoad: 2, elementTypes: 3, nearMissCount: 2 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 },
  distractorPlan: ['IR', 'WR', 'PM', 'WR', 'PM'],
  sampleParams,
  buildCell(values) {
    return cellFor(fromSetVal(values[BLACK_AXIS]), fromSetVal(values[HATCHED_AXIS]))
  },
  buildDistractors(ctx: DistractorCtx<Bits2OpParams>) {
    const K = fromSetVal(ctx.valueAt(BLACK_AXIS, 3, 3))
    const H = fromSetVal(ctx.valueAt(HATCHED_AXIS, 3, 3))
    const c1b = fromSetVal(ctx.valueAt(BLACK_AXIS, 3, 1))
    const c2b = fromSetVal(ctx.valueAt(BLACK_AXIS, 3, 2))
    const c1h = fromSetVal(ctx.valueAt(HATCHED_AXIS, 3, 1))
    const c2h = fromSetVal(ctx.valueAt(HATCHED_AXIS, 3, 2))
    const sharedBlack = interSet(c1b, c2b) // one position
    const sharedHatched = interSet(c1h, c2h) // one position
    const missingHatched = minusSet(ctx.params.domainHatched, H) // one position
    const contextCells = ctx.grid.map((gc) => ({ elements: gc.elements }))

    const mk = (b: readonly Pos[], h: readonly Pos[], label: 'IR' | 'WR' | 'PM' | 'RP', mechanism: string): DistractorCandidate => ({
      elements: cellFor(b, h),
      label,
      mechanism,
      wrongAxes: [...(sameSet(b, K) ? [] : [BLACK_AXIS]), ...(sameSet(h, H) ? [] : [HATCHED_AXIS])],
    })
    const validSet = (cands: DistractorCandidate[]): boolean => {
      if (cands.some((c) => c.wrongAxes.length === 0)) return false
      if (cands.some((c) => cellEq({ elements: c.elements }, ctx.keyCell))) return false
      for (let i = 0; i < cands.length; i++) for (let j = i + 1; j < cands.length; j++) if (cellEq({ elements: cands[i].elements }, { elements: cands[j].elements })) return false
      const cells = [{ elements: ctx.keyCell.elements }, ...cands.map((c) => ({ elements: c.elements }))]
      if (optionComplexitySpreadCheck(cells, false).status !== 'pass') return false
      if (keyBulkExtremumCheck(cells, 0).status !== 'pass') return false
      if (!copyEliminationOk(contextCells, cells, 0)) return false
      if (!singleRuleSufficiencyOk(cells, 0, ctx.axes, ctx.template.cheapAxes)) return false
      if (!eliminationResistanceOk(contextCells, cells, 0, ctx.axes)) return false
      if (!contextBlindGate(cells, 0, ctx.axes).ok) return false
      return giveawayPairGate(cells, ctx.axes).ok
    }

    // Free choices, searched deterministically (N=6, so 5 distractors):
    // which black position s is dropped (X = K − s, Y = X + x₃) and which
    // hatched position h is dropped (W = H − h). The shared hatched position
    // is tried first for h, because W is then exactly the operands' XOR — the
    // wrong OPERATOR, the most diagnostic hatched error — and only then the
    // other two.
    const hOrder = [...sharedHatched, ...H.filter((p) => !sharedHatched.includes(p))]
    for (const s of K) {
      const X = minusSet(K, [s])
      const Y = unionSet(X, sharedBlack)
      for (const h of hOrder) {
        const W = minusSet(H, [h])
        const wMech = sharedHatched.includes(h) ? 'wrongRule:xor_instead_of_union' : `incomplete:union_minus_${h}`
        const cands = [
          mk(X, H, 'IR', `incomplete:xor_minus_${s}`),
          mk(K, W, 'WR', wMech),
          mk(X, W, 'PM', `chimera:xor_minus_${s}+${wMech}`),
          mk(Y, H, 'WR', `wrongRule:shared_black_kept_drop_${s}`),
          mk(Y, W, 'PM', `chimera:both_${s}/${h}`),
        ]
        if (validSet(cands)) return cands
      }
    }

    // Last resort: every 5-subset of the in-vocabulary pool (X/Y/W/V variants
    // and copies of visible cells), first to clear the gates.
    const pool: Array<{ b: Pos[]; h: Pos[]; label: 'IR' | 'WR' | 'PM' | 'RP'; mech: string }> = []
    for (const s of K) {
      const X = minusSet(K, [s])
      const Y = unionSet(X, sharedBlack)
      pool.push({ b: X, h: H, label: 'IR', mech: `incomplete:xor_minus_${s}` }, { b: Y, h: H, label: 'WR', mech: `wrongRule:shared_black_kept_drop_${s}` })
      for (const h of H) {
        const W = minusSet(H, [h])
        const V = unionSet(W, missingHatched)
        pool.push({ b: K, h: W, label: 'WR', mech: `incomplete:union_minus_${h}` }, { b: K, h: V, label: 'WR', mech: `wrongRule:hatched_swap_${h}` }, { b: X, h: W, label: 'PM', mech: `chimera:${s}/${h}` }, { b: Y, h: V, label: 'WR', mech: `wrongRule:both_${s}/${h}` }, { b: X, h: V, label: 'PM', mech: `chimera:${s}/${h}v` }, { b: Y, h: W, label: 'PM', mech: `chimera:${s}y/${h}` })
      }
    }
    for (const gc of ctx.grid) pool.push({ b: fromSetVal(ctx.valueAt(BLACK_AXIS, gc.row, gc.col)), h: fromSetVal(ctx.valueAt(HATCHED_AXIS, gc.row, gc.col)), label: 'RP', mech: `copyCell:R${gc.row}C${gc.col}` })
    const uniq: typeof pool = []
    for (const p of pool) if (!uniq.some((u) => sameSet(u.b, p.b) && sameSet(u.h, p.h)) && !(sameSet(p.b, K) && sameSet(p.h, H))) uniq.push(p)
    for (let i = 0; i < uniq.length; i++)
      for (let j = i + 1; j < uniq.length; j++)
        for (let k = j + 1; k < uniq.length; k++)
          for (let l = k + 1; l < uniq.length; l++)
            for (let m = l + 1; m < uniq.length; m++) {
              const cands = [uniq[i], uniq[j], uniq[k], uniq[l], uniq[m]].map((p) => mk(p.b, p.h, p.label, p.mech))
              if (validSet(cands)) return cands
            }
    throw new Error(`LRM-BITS-2OP: no distractor construction cleared the gates for ${JSON.stringify(ctx.params)}`)
  },
  nonCardinalAsymmetricRotation: () => false,
  structuralExtra: (params: Bits2OpParams) => ({
    domainBlack: params.domainBlack,
    domainHatched: params.domainHatched,
    rows: params.rows.map((r) => ({ c1b: sortPos(r.c1b), c2b: sortPos(r.c2b), c1h: sortPos(r.c1h), c2h: sortPos(r.c2h) })),
  }),
}
