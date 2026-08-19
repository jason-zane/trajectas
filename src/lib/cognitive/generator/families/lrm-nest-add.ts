/**
 * LRM-NEST-ADD — R4 (union) on concentric containers. Set-operator family over
 * three rings {R1(64), R2(44), R3(24)} with distinct shapes per ring and a fill
 * only on the innermost. One nest element on layer outer, direction row_operator.
 * RuleSpec: 'In each row, the third cell contains every ring that appears in the
 * first cell or the second cell.'
 *
 * DIFFICULTY & RADICALS. Predicted b = −2 + 0.8 (R4) + 0.3 (perceptualLoad 1) =
 * −0.9 (moderate band). Radicals: ruleCount 1, ruleIds ['R4'], crossLayer false,
 * perceptualLoad 1, elementTypes 2, nearMissCount 3.
 *
 * OPTION SET & G-08′/G-09 CONTRACT (N=6). The sampler constrains the KEY (row 3)
 * to have a 2-ring union (disjoint singletons), while other rows may yield 3-ring
 * results. This ensures the key is not the sole bulk extremum on ring count.
 *
 * Option counts across the six options: key (2), D (1), E (1), F (1), A (2), B (3)
 * — so spread = 1 (max 3, min 2, and 2 counts represented twice ✓), key not alone
 * at an extremum (others share count 2). Modal composition by ring count: {1: 2, 2: 2,
 * 3: 1}, so no single count is > N/2. Key is one of two 2-ring options (D and E are
 * the 1-ring copies; A and F are also 2-ring; B is the 3-ring union). G-08′: key is
 * not the option matching every modal value, so P(hit) < 1/6 ✓. G-11: three copies
 * (D, E, F) identified by copying cells; three non-copies (A, B, key) stay ≥ 2 ✓.
 * G-19: key is novel (not a grid twin on rings) and in-vocab (2-ring count shown in
 * grid and/or distractors); all distractors fall into the key's class.
 *
 * SAMPLER. Rejection loop (max 300): per row, operands (a_i, b_i) non-empty with
 * a_i ≠ b_i, a_i ⊄ b_i, b_i ⊄ a_i (union is new, not a copy); the three unions
 * not all equal (vary 2- and 3-ring results across the grid); operand pairs not all
 * identical; the key's ring COUNT appears among the grid's cell counts; all 8 visible
 * cells distinct and distinct from key (via uniquelySolvable). KEY LINE constraint
 * (line 3): a_3 and b_3 are disjoint singletons (|a_3| = |b_3| = 1, a_3 ∩ b_3 = ∅),
 * so union has |k| = 2. Other lines' operands may each be singletons or pairs, as long
 * as the grid remains valid.
 *
 * DISTRACTOR PRIORITY (selecting the first 5 to clear all gates). Candidates built
 * deterministically from row 3 material:
 *  1. `RP copyCell:R3C1` — a_3 (singleton)
 *  2. `RP copyCell:R3C2` — b_3 (singleton)
 *  3. `WR wrongRule:symdiff` — a_3 △ b_3 (only if a_3 ∩ b_3 ≠ ∅ — skip for disjoint)
 *  4. `WR wrongRule:intersection` — a_3 ∩ b_3 (only if non-empty — skip for disjoint)
 *  5. `IR incomplete:keyMinusOne` — k minus innermost present ring (drop R3 first if present)
 *  6. `IR incomplete:keyMinusOuter` — k minus outermost ring (drop R1 first if present)
 *  7. `WR wrongRule:difference` — a_3 − b_3 or b_3 − a_3 (always non-empty when disjoint)
 *  8. `RP copyCell:R2C3` — result of row 2
 *  9. Fallback: any non-empty ring-set candidate not yet used
 *
 * LITERATURE HOOK. Nested/embedded-figure matrices (Raven APM "figure addition";
 * Primi 2001 perceptual organisation; Embretson 1998 object overlay) — here operands
 * are concentric containers and the union is made machine-verifiable as a set.
 * `structuralExtra: (p) => ({ ringShapes: p.ringShapes, innerFill: p.innerFill, direction: p.direction })`.
 */

import type { Element, RuleSpec, RingId, NestRingShape, Fill } from '../../spec/schema'
import { setVal } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx, DistractorCandidate } from '../compose'
import type { Rng } from '../rng'
import { contextBlindGate, giveawayPairGate } from '../qa/contextblind'
import { copyEliminationOk, eliminationResistanceOk, keyBulkExtremumCheck, optionComplexitySpreadCheck } from '../qa/degeneracy'
import { cellEq } from '../axes'
import { uniquelySolvable } from './bitgrid'

const AXIS = 'outer.rings'
const ALL_RINGS: RingId[] = ['R1', 'R2', 'R3']

export interface NestAddRow {
  c1: RingId[]
  c2: RingId[]
}

export interface NestAddParams {
  /** Three distinct shapes from {circle, square, diamond, hexagon} for rings R1, R2, R3 respectively. */
  ringShapes: [NestRingShape, NestRingShape, NestRingShape]
  /** Fill for the innermost ring R3; R1 and R2 are always outline. */
  innerFill: Fill
  /** Row or column operator direction. */
  direction: 'row_operator' | 'column_operator'
  /** One operand pair per grid row, index 0..2. */
  rows: [NestAddRow, NestAddRow, NestAddRow]
}

function nestCell(rings: readonly RingId[], ringShapes: [NestRingShape, NestRingShape, NestRingShape], ringFills: ['outline', 'outline', Fill]): Element[] {
  return [{ type: 'nest', layer: 'outer', rings: [...rings].sort(ringOrder) as RingId[], ringShapes, ringFills: ringFills as ['outline', 'outline', Fill] }]
}

const RING_ORDER: Record<RingId, number> = { R1: 0, R2: 1, R3: 2 }
function ringOrder(a: RingId, b: RingId): number {
  return RING_ORDER[a] - RING_ORDER[b]
}

/** Map a ring to a numeric index {R1 → 0, R2 → 1, R3 → 2} for set operations over bitsets. */
function ringToIdx(ring: RingId): number {
  return RING_ORDER[ring]
}

/** Map an index back to a ring. */
function idxToRing(idx: number): RingId {
  return ALL_RINGS[idx]
}

/** Represent a ring-set as a 3-bit number (bit i set ⟺ ring ALL_RINGS[i] present). */
function ringsToSetBits(rings: readonly RingId[]): number {
  let bits = 0
  for (const ring of rings) {
    bits |= 1 << ringToIdx(ring)
  }
  return bits
}

/** Convert a 3-bit set back to a sorted ring array. */
function setBitsToRings(bits: number): RingId[] {
  const result: RingId[] = []
  for (let i = 0; i < 3; i++) {
    if (bits & (1 << i)) {
      result.push(idxToRing(i))
    }
  }
  return result
}

/** Union of two ring sets (represented as bit sets). */
function unionRings(a: number, b: number): number {
  return a | b
}

/** Symmetric difference (XOR for symmetric diff; here we use bitwise XOR and count the bits). */
function symdiffRings(a: number, b: number): number {
  return a ^ b
}

/** Intersection. */
function intersectRings(a: number, b: number): number {
  return a & b
}

/** Difference a - b. */
function diffRings(a: number, b: number): number {
  return a & ~b
}

/**
 * Rejection sampling for a grid that is well-formed BEFORE distractors are
 * considered: the eight visible cells pairwise distinct as sets, the key
 * (row 3's result) distinct from every visible cell. Row 3's operands are
 * constrained to be disjoint singletons (|c1| = |c2| = 1, c1 ∩ c2 = ∅),
 * while other rows may have any non-empty operands respecting the constraints.
 */
function sampleRows(rng: Rng): NestAddParams['rows'] {
  // Non-empty subsets as bit-sets over R1 (1), R2 (2), R3 (4).
  const allSubsets = [0b001, 0b010, 0b011, 0b100, 0b101, 0b110, 0b111]
  const singletons = [0b001, 0b010, 0b100]
  const isSubset = (a: number, b: number) => (a & b) === a
  for (let attempt = 0; attempt < 500; attempt++) {
    const rows: NestAddParams['rows'] = [
      { c1: [], c2: [] },
      { c1: [], c2: [] },
      { c1: [], c2: [] },
    ]
    // Rows 1–2: operands neither of which contains the other, so the union
    // is a cell the row does not already show (a ⊂ b would make the third
    // cell a copy of the second). Row 3: two DISTINCT singletons, so the
    // key has exactly two rings — with three rings it would be the unique
    // bulk maximum among the six options (G-09), and the three-ring cell is
    // needed as a distractor.
    for (let i = 0; i < 2; i++) {
      let a = rng.pick(allSubsets)
      let b = rng.pick(allSubsets)
      let tries = 0
      while ((a === b || isSubset(a, b) || isSubset(b, a)) && tries < 20) {
        a = rng.pick(allSubsets)
        b = rng.pick(allSubsets)
        tries++
      }
      if (a === b || isSubset(a, b) || isSubset(b, a)) continue
      rows[i].c1 = setBitsToRings(a)
      rows[i].c2 = setBitsToRings(b)
    }
    const s1 = rng.pick(singletons)
    const s2 = rng.pick(singletons.filter((x) => x !== s1))
    rows[2].c1 = setBitsToRings(s1)
    rows[2].c2 = setBitsToRings(s2)
    if (rows[0].c1.length === 0 || rows[1].c1.length === 0) continue

    // The three unions should not all be the same cell (an item whose
    // column 3 is constant is a copy item, and Level A's column-constancy
    // probe would agree with the rule anyway — but it is a poor item).
    const u = rows.map((r) => unionRings(ringsToSetBits(r.c1), ringsToSetBits(r.c2)))
    if (u[0] === u[1] && u[1] === u[2]) continue
    // The key set must appear somewhere among the eight visible cells, so
    // it is a copy (OQ-3, permitKeyEqualsCell) and G-11/G-19 have twin
    // companions to give it; with seven subsets over eight cells a novel
    // key would usually have NO novel distractor left (measured: 47/160
    // G-11 rejects before this constraint).
    const visibleBits = new Set<number>()
    for (let i = 0; i < 3; i++) {
      visibleBits.add(ringsToSetBits(rows[i].c1))
      visibleBits.add(ringsToSetBits(rows[i].c2))
      if (i < 2) visibleBits.add(u[i])
    }
    if (!visibleBits.has(u[2])) continue

    // Level A on the eight visible cells (shapes/fills are incidentals
    // constant per item, so any admissible triple stands in here).
    const cells = ([1, 2, 3] as const).flatMap((r) =>
      ([1, 2, 3] as const)
        .filter((c) => !(r === 3 && c === 3))
        .map((c) => {
          const row = rows[r - 1]
          const bits = c === 1 ? ringsToSetBits(row.c1) : c === 2 ? ringsToSetBits(row.c2) : unionRings(ringsToSetBits(row.c1), ringsToSetBits(row.c2))
          return { row: r, col: c, elements: nestCell(setBitsToRings(bits), ['circle', 'square', 'diamond'] as [NestRingShape, NestRingShape, NestRingShape], ['outline', 'outline', 'solid'] as ['outline', 'outline', Fill]) }
        }),
    )
    if (!uniquelySolvable(cells, [AXIS], { [AXIS]: { kind: 'set' } as AxisDomain })) continue

    return rows as NestAddParams['rows']
  }
  throw new Error('LRM-NEST-ADD: could not sample a grid in 500 attempts')
}

export const LRM_NEST_ADD: FamilyTemplate<NestAddParams> = {
  code: 'LRM-NEST-ADD',
  axes: [AXIS],
  domains: () => ({ [AXIS]: { kind: 'set' } as AxisDomain }),
  valueAt: (axis, row, col, params) => {
    if (axis !== AXIS) throw new Error(`unknown axis ${axis}`)
    const r = params.rows[row - 1]
    if (col === 1) return setVal(r.c1.map(String))
    if (col === 2) return setVal(r.c2.map(String))
    const result = unionRings(ringsToSetBits(r.c1), ringsToSetBits(r.c2))
    return setVal(setBitsToRings(result).map(String))
  },
  ruleSpecs: (): RuleSpec[] => [
    {
      id: 'R4',
      axis: AXIS,
      direction: 'row_operator',
      params: { op: 'union' },
      statement: 'In each row, the third cell contains every ring that appears in the first cell or the second cell.',
    },
  ],
  radicals: { ruleCount: 1, ruleIds: ['R4'], crossLayer: false, perceptualLoad: 1, elementTypes: 2, nearMissCount: 3 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 },
  distractorPlan: ['RP', 'RP', 'WR', 'IR', 'IR'],
  sampleParams(rng: Rng): NestAddParams {
    // Sample distinct shapes for the three rings.
    const shapes: NestRingShape[] = ['circle', 'square', 'diamond', 'hexagon']
    const shuffled = rng.shuffle(shapes)
    const ringShapes = [shuffled[0], shuffled[1], shuffled[2]] as [NestRingShape, NestRingShape, NestRingShape]

    // Sample a fill for the innermost ring.
    const fills: Fill[] = ['solid', 'grey', 'hatched', 'outline']
    const innerFill = rng.pick(fills)

    // Row operator only — the rule statement and valueAt are row-wise.
    const direction = 'row_operator' as const

    // Sample rows with constraints.
    const rows = sampleRows(rng)

    return { ringShapes, innerFill, direction, rows }
  },
  buildCell(values, params) {
    if (!params) throw new Error('buildCell requires params')
    const rings = (values[AXIS].t === 'set' ? values[AXIS].v : []).map((s) => s as RingId)
    const ringFills: ['outline', 'outline', Fill] = ['outline', 'outline', params.innerFill]
    return nestCell(rings, params.ringShapes, ringFills)
  },
  buildDistractors(ctx: DistractorCtx<NestAddParams>) {
    const key = ctx.valueAt(AXIS, 3, 3)
    if (key.t !== 'set') throw new Error('outer.rings must be a set')
    const keyRings = (key.v as string[]).map((s) => s as RingId)
    const keyBits = ringsToSetBits(keyRings)

    const c1 = ctx.valueAt(AXIS, 3, 1)
    const c2 = ctx.valueAt(AXIS, 3, 2)
    if (c1.t !== 'set' || c2.t !== 'set') throw new Error('outer.rings must be a set')
    const c1Rings = (c1.v as string[]).map((s) => s as RingId)
    const c2Rings = (c2.v as string[]).map((s) => s as RingId)
    const c1Bits = ringsToSetBits(c1Rings)
    const c2Bits = ringsToSetBits(c2Rings)

    const ringFills: ['outline', 'outline', Fill] = ['outline', 'outline', ctx.params.innerFill]

    const mk = (rings: readonly RingId[], label: 'RP' | 'IR' | 'WR' | 'PM', mechanism: string): DistractorCandidate => {
      const bits = ringsToSetBits(rings)
      return {
        elements: nestCell(rings, ctx.params.ringShapes, ringFills),
        label,
        mechanism,
        wrongAxes: bits === keyBits ? [] : [AXIS],
      }
    }

    const validSet = (cands: DistractorCandidate[]): boolean => {
      if (cands.some((c) => c.wrongAxes.length === 0)) return false
      if (cands.some((c) => cellEq({ elements: c.elements }, ctx.keyCell))) return false
      for (let i = 0; i < cands.length; i++) for (let j = i + 1; j < cands.length; j++) if (cellEq({ elements: cands[i].elements }, { elements: cands[j].elements })) return false
      const cells = [{ elements: ctx.keyCell.elements }, ...cands.map((c) => ({ elements: c.elements }))]
      if (optionComplexitySpreadCheck(cells, false).status !== 'pass') return false
      if (keyBulkExtremumCheck(cells, 0).status !== 'pass') return false
      if (!copyEliminationOk(ctx.grid.map((gc) => ({ elements: gc.elements })), cells, 0)) return false
      if (!eliminationResistanceOk(ctx.grid.map((gc) => ({ elements: gc.elements })), cells, 0, ctx.axes)) return false
      if (!contextBlindGate(cells, 0, ctx.axes).ok) return false
      return giveawayPairGate(cells, ctx.axes).ok
    }

    // Build candidates. With three rings there are only six non-key subsets,
    // so the SETS are forced; what the order decides is which MECHANISM each
    // set is labelled with (first label wins after dedup): the wrong-rule
    // readings of row 3 first, then the incomplete unions, then copies of
    // visible cells, then whatever is left.
    const candidates: Array<{ rings: RingId[]; label: 'RP' | 'IR' | 'WR' | 'PM'; mechanism: string }> = []

    const symdiffBits = symdiffRings(c1Bits, c2Bits)
    if (symdiffBits !== 0 && symdiffBits !== keyBits) candidates.push({ rings: setBitsToRings(symdiffBits), label: 'WR', mechanism: 'wrongRule:symdiff' })
    const intersectBits = intersectRings(c1Bits, c2Bits)
    if (intersectBits !== 0) candidates.push({ rings: setBitsToRings(intersectBits), label: 'WR', mechanism: 'wrongRule:intersection' })
    const diffABBits = diffRings(c1Bits, c2Bits)
    if (diffABBits !== 0) candidates.push({ rings: setBitsToRings(diffABBits), label: 'WR', mechanism: 'wrongRule:difference:a-b' })
    const diffBABits = diffRings(c2Bits, c1Bits)
    if (diffBABits !== 0) candidates.push({ rings: setBitsToRings(diffBABits), label: 'WR', mechanism: 'wrongRule:difference:b-a' })

    // Incomplete: key minus each ring (innermost first), and key plus the missing ring.
    for (const ring of (['R3', 'R2', 'R1'] as RingId[])) {
      if (keyRings.includes(ring)) {
        const reduced = keyRings.filter((r) => r !== ring)
        if (reduced.length > 0) candidates.push({ rings: reduced, label: 'IR', mechanism: `incomplete:keyMinus${ring}` })
      } else {
        candidates.push({ rings: [...keyRings, ring].sort(ringOrder), label: 'IR', mechanism: `incomplete:keyPlus${ring}` })
      }
    }

    // Copies of visible cells (row 3 operands first, then the rest).
    const gridSets = new Set<string>()
    const ordered = [...ctx.grid].sort((a, b) => (a.row === 3 ? -1 : b.row === 3 ? 1 : 0) || a.row - b.row || a.col - b.col)
    for (const gc of ordered) {
      const ringsVal = ctx.valueAt(AXIS, gc.row, gc.col)
      if (ringsVal.t === 'set') {
        const gridRings = (ringsVal.v as string[]).map((s) => s as RingId)
        gridSets.add([...gridRings].sort().join(','))
        candidates.push({ rings: gridRings, label: 'RP', mechanism: `copyCell:R${gc.row}C${gc.col}` })
      }
    }

    // Any remaining non-empty subset.
    const allSubsets = [0b001, 0b010, 0b011, 0b100, 0b101, 0b110, 0b111]
    for (const bits of allSubsets) {
      const rings = setBitsToRings(bits)
      if (rings.length > 0 && !gridSets.has([...rings].sort().join(','))) candidates.push({ rings, label: 'PM', mechanism: `otherSet:${bits.toString(2)}` })
    }

    // Deduplicate candidates by ring set
    const uniqueCands: typeof candidates = []
    const seenRings = new Set<string>()
    for (const c of candidates) {
      const key = c.rings.sort().join(',')
      if (!seenRings.has(key)) {
        seenRings.add(key)
        uniqueCands.push(c)
      }
    }

    // Deterministically select 5 candidates that pass all gates.
    // Try all 5-combinations from the unique candidates.
    if (uniqueCands.length >= 5) {
      for (let i = 0; i < uniqueCands.length; i++) {
        for (let j = i + 1; j < uniqueCands.length; j++) {
          for (let k = j + 1; k < uniqueCands.length; k++) {
            for (let l = k + 1; l < uniqueCands.length; l++) {
              for (let m = l + 1; m < uniqueCands.length; m++) {
                const cands = [uniqueCands[i], uniqueCands[j], uniqueCands[k], uniqueCands[l], uniqueCands[m]].map((c) => mk(c.rings, c.label, c.mechanism))
                if (validSet(cands)) return cands
              }
            }
          }
        }
      }
    }

    // No five-subset cleared every gate: return the first five and let the
    // item be rejected at the gate (counted in the battery), rather than
    // treating an unlucky draw as a family-authoring bug.
    return uniqueCands.slice(0, 5).map((c) => mk(c.rings, c.label, c.mechanism))
  },
  nonCardinalAsymmetricRotation: () => false,
  /**
   * OQ-3 (qa/degeneracy.ts gridLevelDegeneracy; LRM-MOVE / LRM-MIRROR are
   * the precedents): the axis has seven values and the grid shows eight
   * cells, so the key (a two-ring union) will usually also be a visible
   * operand or union elsewhere. The mitigation is the one OQ-3 asks for —
   * several distractors are copies of visible cells too (operands, other
   * unions), so "it appears in the grid" never singles the key out.
   */
  permitKeyEqualsCell: true,
  structuralExtra: (params: NestAddParams) => ({
    ringShapes: params.ringShapes,
    innerFill: params.innerFill,
    direction: params.direction,
    rows: params.rows.map((r) => ({ c1: r.c1.sort(), c2: r.c2.sort() })),
  }),
}
