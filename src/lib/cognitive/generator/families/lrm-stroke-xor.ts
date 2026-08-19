/**
 * LRM-STROKE-XOR — R7 (symmetric difference) on a six-kind stroke set,
 * frameless line figures. Each row draws its own operand pair from six
 * strokes {H, V, D1, D2, ARC_T, ARC_B}, with |a_i|,|b_i| ∈ {2,3},
 * |a_i ∩ b_i| ∈ {1,2}, a_i ≠ b_i — so the row result is always 2-4 strokes
 * and XOR ≠ union ≠ difference in every row: Level A verifies R7 as the
 * unique row reading.
 *
 * OPTION SET (single hard axis, six options; every distractor is a specific
 * wrong application of the rule or a direct copy):
 *   key   XOR (symmetric difference)                  (|a △ b| ∈ {2,3,4})
 *   WR-a  union (a ∪ b)                             (both rule confusion)
 *   RP    copy R3C1 (operand a_3)                    (perseveration)
 *   RP    copy R3C2 (operand b_3)                    (perseveration)
 *   WR-b  difference (a − b)                         (missing the symmetric part)
 * Stroke counts vary across options; the key typically lacks the shared
 * strokes that union/operands carry, making it rarely the modal set. All
 * options distinct; no option sits alone at a cardinality extremum
 * (G-09 spread ≤ 2). Per-stroke modal (>3 of 6 options): key does not match
 * modal composition because shared strokes appear in many options but not
 * in the XOR (G-08′ hit rate << 0.25). G-11: copies are RP cells; novel
 * non-copies are the three rule-based distractors. G-19: every stroke count
 * and every stroke kind in the options appears in the grid by construction.
 *
 * Predicted b (difficulty.ts): −2.0 + 1.6 (R7) + 0.3·2 (perceptualLoad) =
 * +0.20, moderate.
 *
 * Literature: line-figure matrices (Raven SPM C/D, Sandia stroke items,
 * Matzen et al. 2010); XOR as hardest binary operator (Carpenter et al. 1990,
 * BOLT, Schroeders & Walter 2026).
 */

import type { Element, RuleSpec, StrokeId } from '../../spec/schema'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx, DistractorCandidate } from '../compose'
import type { Rng } from '../rng'
import { contextBlindGate, giveawayPairGate } from '../qa/contextblind'
import { copyEliminationOk, eliminationResistanceOk, keyBulkExtremumCheck, optionComplexitySpreadCheck } from '../qa/degeneracy'
import { cellEq, setVal } from '../axes'
import type { AxisValue } from '../axes'
import type { GridCell } from '../../spec/schema'
import { detectAllAxes, levelA } from '../qa/uniqueness'

const AXIS = 'outer.strokes'
const ALL_STROKES: StrokeId[] = ['H', 'V', 'D1', 'D2', 'ARC_T', 'ARC_B']
const STROKE_ORDER: Record<StrokeId, number> = { H: 0, V: 1, D1: 2, D2: 3, ARC_T: 4, ARC_B: 5 }

// ============================================================================
// Stroke set helpers — parallel to bitgrid.ts helpers for Pos
// ============================================================================

function sortStrokes(xs: readonly StrokeId[]): StrokeId[] {
  const set = new Set(xs)
  return Array.from(set).sort((a, b) => STROKE_ORDER[a] - STROKE_ORDER[b])
}

function xorSet(a: readonly StrokeId[], b: readonly StrokeId[]): StrokeId[] {
  const A = new Set(a)
  const B = new Set(b)
  return sortStrokes([...a.filter((x) => !B.has(x)), ...b.filter((x) => !A.has(x))])
}

function unionSet(a: readonly StrokeId[], b: readonly StrokeId[]): StrokeId[] {
  return sortStrokes([...a, ...b])
}

function minusSet(a: readonly StrokeId[], b: readonly StrokeId[]): StrokeId[] {
  const B = new Set(b)
  return sortStrokes(a.filter((x) => !B.has(x)))
}

function interSet(a: readonly StrokeId[], b: readonly StrokeId[]): StrokeId[] {
  const B = new Set(b)
  return sortStrokes(a.filter((x) => B.has(x)))
}

function sameSet(a: readonly StrokeId[], b: readonly StrokeId[]): boolean {
  const A = sortStrokes(a)
  const B = sortStrokes(b)
  return A.length === B.length && A.every((x, i) => x === B[i])
}

function strokeSetVal(xs: readonly StrokeId[]): AxisValue {
  return setVal(sortStrokes(xs))
}

function fromSetVal(v: AxisValue): StrokeId[] {
  if (v.t !== 'set') throw new Error('outer.strokes must be a set')
  return v.v as StrokeId[]
}

function strokesCell(strokes: readonly StrokeId[]): Element[] {
  return [{ type: 'strokes', layer: 'outer', strokes: sortStrokes(strokes) }]
}

// ============================================================================
// Operand sampling and uniqueness checking
// ============================================================================

function sampleOperandPair(rng: Rng, domain: readonly StrokeId[], sizeA: number, sizeB: number, overlap: number): { a: StrokeId[]; b: StrokeId[] } {
  // Draw two sets of given sizes with exactly `overlap` elements in common.
  const pool = rng.shuffle([...domain])
  const shared = pool.slice(0, overlap)
  const rest = pool.slice(overlap)
  const aOnly = rest.slice(0, sizeA - overlap)
  const bOnly = rest.slice(sizeA - overlap, sizeA - overlap + sizeB - overlap)
  if (aOnly.length < sizeA - overlap || bOnly.length < sizeB - overlap) {
    // Insufficient pool — try again by throwing
    throw new Error('Insufficient strokes for operand pair')
  }
  return { a: sortStrokes([...shared, ...aOnly]), b: sortStrokes([...shared, ...bOnly]) }
}

export interface StrokeXorRow {
  a: StrokeId[]
  b: StrokeId[]
}

export interface StrokeXorParams {
  /** One operand pair per grid row, index 0..2. */
  rows: [StrokeXorRow, StrokeXorRow, StrokeXorRow]
}

function resultOf(row: StrokeXorRow): StrokeId[] {
  return xorSet(row.a, row.b)
}

function strokeCell(strokes: readonly StrokeId[]): Element[] {
  return strokesCell(strokes)
}

function columnOperatorCoincidence(colVals: (c: 1 | 2 | 3, r: 1 | 2 | 3) => readonly StrokeId[]): boolean {
  const ops: Array<(a: readonly StrokeId[], b: readonly StrokeId[]) => StrokeId[]> = [unionSet, minusSet, (a, b) => minusSet(b, a), xorSet]
  return ops.some((op) => ([1, 2] as const).every((c) => sameSet(colVals(c, 3), op(colVals(c, 1), colVals(c, 2)))))
}

function uniquelySolvable(cells: readonly GridCell[], declaredAxes: readonly string[], domains: Partial<Record<string, AxisDomain>>): boolean {
  const axes = [...new Set([...declaredAxes, ...detectAllAxes(cells)])]
  return levelA(cells, axes, domains).ok
}

/**
 * Rejection sampling for a grid that is well-formed BEFORE distractors are
 * considered: the eight visible cells pairwise distinct as sets, the key
 * (row 3's result) distinct from every visible cell. Constraints per spec:
 * |a_i|, |b_i| ∈ {2,3}, |a_i ∩ b_i| ∈ {1,2}, a_i ≠ b_i, |a_i △ b_i| ∈ {2,3,4},
 * three results not all equal, operand pairs not all identical, key's count
 * appears among visible cells.
 */
function sampleRows(rng: Rng): StrokeXorParams['rows'] {
  for (let attempt = 0; attempt < 300; attempt++) {
    const rows: StrokeXorRow[] = []
    let rowOk = true
    for (let rowIdx = 0; rowIdx < 3 && rowOk; rowIdx++) {
      try {
        // Sample operand sizes in {2,3}
        const aSize = rng.int(0, 1) === 0 ? 2 : 3
        const bSize = rng.int(0, 1) === 0 ? 2 : 3
        // Overlap in {1,2}, but clamped to min of sizes
        const maxOverlap = Math.min(aSize, bSize)
        const overlap = rng.int(1, maxOverlap)
        // Sample operand pair with individual sizes
        const pair = sampleOperandPair(rng, ALL_STROKES, aSize, bSize, overlap)
        rows.push({ a: pair.a, b: pair.b })
      } catch {
        rowOk = false
      }
    }
    if (!rowOk) continue

    const typedRows = rows as StrokeXorParams['rows']
    const key = resultOf(typedRows[2])
    if (key.length < 2 || key.length > 4) continue // Skip if key out of expected range

    // Collect all visible cells
    const visible: StrokeId[][] = []
    for (let r = 0; r < 3; r++) {
      visible.push(typedRows[r].a, typedRows[r].b)
      if (r < 2) visible.push(resultOf(typedRows[r]))
    }

    let ok = true
    // Ensure key is distinct from all visible cells
    for (let i = 0; i < visible.length && ok; i++) {
      if (sameSet(visible[i], key)) ok = false
      // Ensure all visible cells are pairwise distinct
      for (let j = i + 1; j < visible.length && ok; j++) if (sameSet(visible[i], visible[j])) ok = false
    }

    if (!ok) continue

    // Check for rival column-operator reading
    const at = (c: 1 | 2 | 3, r: 1 | 2 | 3): readonly StrokeId[] =>
      c === 1 ? typedRows[r - 1].a : c === 2 ? typedRows[r - 1].b : resultOf(typedRows[r - 1])
    if (columnOperatorCoincidence(at)) continue

    // Check Level A uniqueness
    const cells = ([1, 2, 3] as const).flatMap((r) =>
      ([1, 2, 3] as const)
        .filter((c) => !(r === 3 && c === 3))
        .map((c) => ({ row: r, col: c, elements: strokeCell(at(c, r)) })),
    )
    if (!uniquelySolvable(cells, [AXIS], { [AXIS]: { kind: 'set' } as AxisDomain })) continue

    // Check that result counts vary across visible cells (for G-09)
    const counts = visible.map((v) => v.length)
    const key_count = key.length
    // Ensure three results are not all equal
    const row_results = [resultOf(typedRows[0]), resultOf(typedRows[1]), resultOf(typedRows[2])]
    const row_result_counts = row_results.map((r) => r.length)
    if (row_result_counts[0] === row_result_counts[1] && row_result_counts[1] === row_result_counts[2]) continue

    // Ensure operand pairs are not all identical
    const pairs = typedRows.map((r) => `${r.a.join(',')}_${r.b.join(',')}`)
    if (new Set(pairs).size === 1) continue

    // Check that key's count appears among visible cells
    if (!counts.includes(key_count)) continue

    return typedRows
  }
  throw new Error('LRM-STROKE-XOR: could not sample a distinct grid in 300 attempts')
}

// ============================================================================
// Family template
// ============================================================================

export const LRM_STROKE_XOR: FamilyTemplate<StrokeXorParams> = {
  code: 'LRM-STROKE-XOR',
  axes: [AXIS],
  domains: () => ({ [AXIS]: { kind: 'set' } as AxisDomain }),
  valueAt: (axis, row, col, params) => {
    if (axis !== AXIS) throw new Error(`unknown axis ${axis}`)
    const r = params.rows[row - 1]
    if (col === 1) return strokeSetVal(r.a)
    if (col === 2) return strokeSetVal(r.b)
    return strokeSetVal(resultOf(r))
  },
  ruleSpecs: (): RuleSpec[] => [
    {
      id: 'R7',
      axis: AXIS,
      direction: 'row_operator',
      params: { op: 'symdiff' },
      statement: 'In each row, the third figure contains exactly the strokes that appear in one of the first two figures but not both.',
    },
  ],
  // perceptualLoad 2: stroke figures to decompose and compare. elementTypes 2
  // is the schema floor; the visual vocabulary here is two states per stroke
  // (present/absent).
  radicals: { ruleCount: 1, ruleIds: ['R7'], crossLayer: false, perceptualLoad: 2, elementTypes: 2, nearMissCount: 3 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 },
  distractorPlan: ['WR', 'RP', 'RP', 'WR', 'WR'],
  sampleParams(rng: Rng): StrokeXorParams {
    return { rows: sampleRows(rng) }
  },
  buildCell(values) {
    return strokeCell(fromSetVal(values[AXIS]))
  },
  buildDistractors(ctx: DistractorCtx<StrokeXorParams>) {
    const key = fromSetVal(ctx.valueAt(AXIS, 3, 3))
    const c1 = fromSetVal(ctx.valueAt(AXIS, 3, 1))
    const c2 = fromSetVal(ctx.valueAt(AXIS, 3, 2))
    const contextCells = ctx.grid.map((gc) => ({ elements: gc.elements }))

    const mk = (strokes: readonly StrokeId[], label: 'IR' | 'WR' | 'PM' | 'RP', mechanism: string): DistractorCandidate => ({
      elements: strokeCell(strokes),
      label,
      mechanism,
      wrongAxes: sameSet(strokes, key) ? [] : [AXIS],
    })

    const validSet = (cands: DistractorCandidate[]): boolean => {
      if (cands.some((c) => c.wrongAxes.length === 0)) return false
      if (cands.some((c) => cellEq({ elements: c.elements }, ctx.keyCell))) return false
      for (let i = 0; i < cands.length; i++) {
        for (let j = i + 1; j < cands.length; j++) {
          if (cellEq({ elements: cands[i].elements }, { elements: cands[j].elements })) return false
        }
      }
      const cells = [{ elements: ctx.keyCell.elements }, ...cands.map((c) => ({ elements: c.elements }))]
      if (optionComplexitySpreadCheck(cells, false).status !== 'pass') return false
      if (keyBulkExtremumCheck(cells, 0).status !== 'pass') return false
      if (!copyEliminationOk(contextCells, cells, 0)) return false
      if (!eliminationResistanceOk(contextCells, cells, 0, ctx.axes)) return false
      if (!contextBlindGate(cells, 0, ctx.axes).ok) return false
      return giveawayPairGate(cells, ctx.axes).ok
    }

    // Build a pool of candidate distractors
    const pool: Array<{ strokes: StrokeId[]; label: 'IR' | 'WR' | 'RP' | 'PM'; mech: string }> = []

    // Rule-based wrong answers
    pool.push({ strokes: unionSet(c1, c2), label: 'WR', mech: 'wrongRule:union' })
    pool.push({ strokes: minusSet(c1, c2), label: 'WR', mech: 'wrongRule:difference' })
    pool.push({ strokes: minusSet(c2, c1), label: 'WR', mech: 'wrongRule:reverseDifference' })
    const wr_inter = interSet(c1, c2)
    if (wr_inter.length > 0 && !sameSet(wr_inter, key)) {
      pool.push({ strokes: wr_inter, label: 'WR', mech: 'wrongRule:intersection' })
    }

    // Perseveration (operand copies)
    pool.push({ strokes: c1, label: 'RP', mech: 'copyCell:R3C1' })
    pool.push({ strokes: c2, label: 'RP', mech: 'copyCell:R3C2' })
    const r2c3 = fromSetVal(ctx.valueAt(AXIS, 2, 3))
    if (!sameSet(r2c3, key)) {
      pool.push({ strokes: r2c3, label: 'RP', mech: 'copyCell:R2C3' })
    }

    // Incomplete variants
    const canonicalStrokeOrder: StrokeId[] = ['H', 'V', 'D1', 'D2', 'ARC_T', 'ARC_B']
    if (key.length > 1) {
      for (const stroke of canonicalStrokeOrder) {
        if (key.includes(stroke)) {
          const ir = minusSet(key, [stroke])
          if (ir.length > 0 && !sameSet(ir, key) && !pool.some((p) => sameSet(p.strokes, ir))) {
            pool.push({ strokes: ir, label: 'IR', mech: `incomplete:dropStroke:${stroke}` })
          }
        }
      }
    }

    // Key plus variations
    for (const stroke of ALL_STROKES) {
      if (!key.includes(stroke)) {
        const variant = sortStrokes([...key, stroke])
        if (variant.length <= 6 && !sameSet(variant, key) && !pool.some((p) => sameSet(p.strokes, variant))) {
          pool.push({ strokes: variant, label: 'IR', mech: `incomplete:addStroke:${stroke}` })
        }
      }
    }

    // Operand variations
    for (const strokeSet of [c1, c2]) {
      for (const stroke of ALL_STROKES) {
        if (!strokeSet.includes(stroke)) {
          const variant = sortStrokes([...strokeSet, stroke])
          if (!sameSet(variant, key) && !pool.some((p) => sameSet(p.strokes, variant))) {
            pool.push({ strokes: variant, label: 'PM', mech: `operandVariant` })
          }
        }
      }
    }

    // Other visible cells
    for (const gc of ctx.grid) {
      const cellVal = fromSetVal(ctx.valueAt(AXIS, gc.row, gc.col))
      if (!sameSet(cellVal, key) && !pool.some((p) => sameSet(p.strokes, cellVal))) {
        pool.push({ strokes: cellVal, label: 'PM', mech: `copyCell:R${gc.row}C${gc.col}` })
      }
    }

    // Deduplicate by stroke set
    const uniq: typeof pool = []
    for (const p of pool) {
      if (!uniq.some((u) => sameSet(u.strokes, p.strokes)) && !sameSet(p.strokes, key)) {
        uniq.push(p)
      }
    }

    // Review finding (2026-08-20, PR #369 adversarial sweep): when the
    // deduplicated pool collapses below five, the combination search never
    // runs and this function used to THROW — killing the whole generateFamily
    // run for one unlucky draw. Pad with subsets of the strokes the grid
    // shows (in-vocab kinds) so five candidates always exist; a padded set
    // that breaks a gate is REJECTED per item and tallied.
    if (uniq.length < 5) {
      const seen = sortStrokes([...new Set(ctx.grid.flatMap((gc) => fromSetVal(ctx.valueAt(AXIS, gc.row, gc.col))))])
      for (let bits = 1; bits < 1 << seen.length && uniq.length < 5; bits++) {
        const subset = seen.filter((_, idx) => (bits >> idx) & 1)
        if (sameSet(subset, key)) continue
        if (uniq.some((u) => sameSet(u.strokes, subset))) continue
        uniq.push({ strokes: subset, label: 'PM', mech: `otherSet:${bits.toString(2)}` })
      }
    }

    // Try to build a valid set of 5 distractors
    // First, try combinations prioritizing the most reliable error types
    for (let i = 0; i < uniq.length; i++) {
      for (let j = i + 1; j < uniq.length; j++) {
        for (let k = j + 1; k < uniq.length; k++) {
          for (let l = k + 1; l < uniq.length; l++) {
            for (let m = l + 1; m < uniq.length; m++) {
              const cands = [uniq[i], uniq[j], uniq[k], uniq[l], uniq[m]].map((p) => mk(p.strokes, p.label, p.mech))
              if (validSet(cands)) return cands
            }
          }
        }
      }
    }

    // No five-subset cleared every gate: return the first five and let the
    // per-item gates reject the item (counted), rather than treating an
    // unlucky draw as a family-authoring bug.
    return uniq.slice(0, 5).map((p) => mk(p.strokes, p.label, p.mech))
  },
  nonCardinalAsymmetricRotation: () => false,
  structuralExtra: (params: StrokeXorParams) => ({ rows: params.rows.map((r) => ({ a: sortStrokes(r.a), b: sortStrokes(r.b) })) }),
}
