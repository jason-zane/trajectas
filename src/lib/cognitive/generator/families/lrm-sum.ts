/**
 * LRM-SUM — count arithmetic (hard, R12) × shape Latin square (cheap, R6).
 * ONE `repeat` element on layer `outer`, size `S`, fill constant per item
 * from {solid, grey}. Axes: `outer.shape` (CHEAP, R6 Latin square over a
 * per-item 3-set drawn from {circle, triangle, diamond, star, cross, hexagon};
 * domain unordered-enum; shape = shapeSet[(col−1 + rowOffset·(row−1)) % 3],
 * rowOffset ∈ {1,2}); `outer.count` (HARD, R12: along the operator direction
 * the third cell's count = first + second (op 'sum') or first − second
 * (op 'difference'); `direction ∈ {row_operator, column_operator}`).
 *
 * SIX-OPTION ASYMMETRIC CONTRACT (v3): cheap axis = outer.shape (R6); hard
 * axis = outer.count (R12). Distractors with mechanisms:
 * D1 (s*, c1): shape = key shape, count = wrong count w1 (opposite operation or stall)
 * D2 (s*, c2): shape = key shape, count = wrong count w2 (operand copy or off-by-n)
 * D3 (s*, c3): shape = key shape, count = wrong count w3 (alternative wrong count)
 * D4 (s_alt, c1): shape ≠ key (from Latin set at R3C2), count = c1 (PM incompleteCorrelate)
 * D5 (s_alt2, c1): shape ≠ key (third shape in set), count = c1 (PM incompleteCorrelate)
 *   — both correlates share D1's count: if D5 carried c2 instead, the pair
 *   (key, D4) would be complementary on both axes with D5 sharing nothing
 *   with either, which G-10 reads as a giveaway pair (measured: 160/160
 *   rejects before this change).
 *
 * G-08′ modal hit rate: key count k appears exactly once in the six counts
 * {k, c1, c2, c3, c1, c1}, so the modal count is c1 (×3); key shape s*
 * appears in key, D1, D2, D3 (4 of 6) so the modal shape is s*. The unique
 * modal composition (s*, c1) = D1, so P(hit) = 0 ✓. G-20: cheap survivors on
 * shape = 4 = max(4, N−2) — this family uses the floor.
 * G-09: count spread ≤ 3 by construction (2 ≤ k ≤ 5, wrong counts within bounds);
 * key not sole extremum because c1, c2, c3 straddle k. G-11: no options are copies
 * of grid cells. G-19: all options use counts shown in grid (key is a twin on count,
 * c1/c2/c3 all appear as grid operands); shapes are Latin-square members (in-vocab).
 * G-20: cheap elimination (by shape): D1, D2, D3 match key shape (3 of 6); alone not
 * isolating since key not always solvable from shape alone (hard rule R12 governs count).
 *
 * Sampler: operands per line (a_i, b_i), i = 1..3, each in 1..5, derived
 * c_i = a_i + b_i ≤ 6 (sum) or c_i = a_i − b_i ≥ 1 (difference). Constraints:
 * (1) c_1 ≠ c_2 (column 3 not constant; Level A probe);
 * (2) main diagonal (1,1),(2,2) not equal (diagonal-constancy probe);
 * (3) three operand pairs not all the same multiset;
 * (4) key count k = c_3 appears somewhere among 8 visible counts (k is a twin);
 * (5) 2 ≤ k ≤ 5 (wrong counts exist on both sides for bulk-extremum check);
 * (6) uniquelySolvable(cells, ['outer.shape', 'outer.count'], domains) = true.
 *
 * Distractor counts, priority order: w1 = opposite operation result (if valid);
 * w2 = a_3 (IR copyOperand:pos1); w3 = b_3 (IR copyOperand:pos2); then offBy±1/±2
 * as needed. Each distinct, ≠ k, within 1..6, max−min ≤ 3. Labels: w1 as
 * `WR wrongRule:oppositeOperation`, operand copies as `IR copyOperand:<pos>`,
 * ±n as `WR offBy:<n>`.
 *
 * Literature: Carpenter, Just & Shell (1990) "figure addition/subtraction";
 * numeric addition/subtraction rules in Matzen et al. (2010) Sandia matrices;
 * HeiQ distractor facet design.
 *
 * DIFFICULTY: predicted b ≈ −2 + 0.7 (R12) + 0.45 (R6 halved) + 0.5 (second rule)
 * + 0.3 (perceptualLoad 1) = −0.05 (moderate). cheapAxes: ['outer.shape'].
 */
import type { Element, RuleSpec, ShapeId } from '../../spec/schema'
import { enumVal, numVal } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx, DistractorCandidate } from '../compose'
import type { Rng } from '../rng'
import { uniquelySolvable } from './bitgrid'
import { cellEq } from '../axes'

const SHAPE_AXIS = 'outer.shape'
const COUNT_AXIS = 'outer.count'

// Shapes whose S-size area clears qa/density.ts's 4% ink floor at count 1
// (circle 4.9%, square 6.3%, pentagon 4.1%, hexagon 5.4%; a triangle, diamond,
// star or cross at S does not). Each item draws a 3-set.
const ALL_SHAPES = ['circle', 'square', 'pentagon', 'hexagon'] as const

export interface LRMSumParams {
  shapeSet: readonly [ShapeId, ShapeId, ShapeId]
  rowOffset: 1 | 2
  op: 'sum' | 'difference'
  direction: 'row_operator' | 'column_operator'
  fill: 'solid' | 'grey'
  // Operands for the grid (9 cells worth: 3 rows × 3 columns)
  // Structure: [row1_a, row1_b, row2_a, row2_b, row3_a, row3_b]
  operands: [number, number, number, number, number, number]
}

function shapeAt(shapeSet: readonly [ShapeId, ShapeId, ShapeId], rowOffset: number, row: number, col: number): ShapeId {
  const idx = (col - 1 + rowOffset * (row - 1)) % 3
  return shapeSet[idx]
}

function countAt(operands: [number, number, number, number, number, number], op: 'sum' | 'difference', direction: 'row_operator' | 'column_operator', row: number, col: number): number {
  if (direction === 'row_operator') {
    // Row direction: each row has two free operands in columns 1-2, derived in column 3
    // operands = [row1_a, row1_b, row2_a, row2_b, row3_a, row3_b]
    const rowIdx = row - 1
    const a = operands[rowIdx * 2]
    const b = operands[rowIdx * 2 + 1]
    if (col === 1) return a
    if (col === 2) return b
    if (col === 3) return op === 'sum' ? a + b : a - b
  } else {
    // Column direction: each column has two free operands in rows 1-2, derived in row 3
    // operands = [col1_a, col1_b, col2_a, col2_b, col3_a, col3_b]
    const colIdx = col - 1
    const a = operands[colIdx * 2]
    const b = operands[colIdx * 2 + 1]
    if (row === 1) return a
    if (row === 2) return b
    if (row === 3) return op === 'sum' ? a + b : a - b
  }
  throw new Error(`invalid countAt call: row=${row}, col=${col}`)
}

function repeatCell(count: number, shape: ShapeId, fill: 'solid' | 'grey'): Element[] {
  return [{ type: 'repeat', layer: 'outer', shape: shape, count, size: 'S', fill, rotation: 0 }]
}

// Build the 8 context cells (row-major, skipping row 3 col 3)
function buildContextCells(params: LRMSumParams): Element[][] {
  const cells: Element[][] = []
  const positions: [number, number][] = [
    [1, 1], [1, 2], [1, 3],
    [2, 1], [2, 2], [2, 3],
    [3, 1], [3, 2],
  ]
  for (const [row, col] of positions) {
    const shape = shapeAt(params.shapeSet, params.rowOffset, row, col)
    const count = countAt(params.operands, params.op, params.direction, row, col)
    cells.push(repeatCell(count, shape, params.fill))
  }
  return cells
}

/**
 * Verify that the grid is uniquely solvable on both axes.
 * This checks Level A: that every varying axis has a unique implication for (3,3).
 */
function isGridSafe(params: LRMSumParams): boolean {
  const axes = [SHAPE_AXIS, COUNT_AXIS]
  const domains: Record<string, AxisDomain> = {
    [SHAPE_AXIS]: { kind: 'unordered-enum' },
    [COUNT_AXIS]: { kind: 'numeric-linear' },
  }

  // Build grid cells (8 visible cells, row-major order, skipping (3,3))
  const gridCells: Array<{ row: number; col: number; elements: Element[] }> = []
  for (let r = 1; r <= 3; r++) {
    for (let c = 1; c <= 3; c++) {
      if (r === 3 && c === 3) continue
      const shape = shapeAt(params.shapeSet, params.rowOffset, r, c)
      const count = countAt(params.operands, params.op, params.direction, r, c)
      gridCells.push({
        row: r,
        col: c,
        elements: repeatCell(count, shape, params.fill),
      })
    }
  }

  // Eight visible cells only — Level A must re-derive (3,3) from them.
  return uniquelySolvable(gridCells, axes, domains)
}

export const LRM_SUM: FamilyTemplate<LRMSumParams> = {
  code: 'LRM-SUM',
  axes: [SHAPE_AXIS, COUNT_AXIS],
  cheapAxes: [SHAPE_AXIS],
  domains: () => ({
    [SHAPE_AXIS]: { kind: 'unordered-enum' } as AxisDomain,
    [COUNT_AXIS]: { kind: 'numeric-linear' } as AxisDomain,
  }),
  valueAt: (axis, row, col, params) => {
    if (axis === SHAPE_AXIS) return enumVal(shapeAt(params.shapeSet, params.rowOffset, row, col))
    if (axis === COUNT_AXIS) return numVal(countAt(params.operands, params.op, params.direction, row, col))
    throw new Error(`unknown axis ${axis}`)
  },
  ruleSpecs: (params): RuleSpec[] => {
    const directionWord = params.direction === 'row_operator' ? 'row' : 'column'
    const statement = params.op === 'sum'
      ? `In each ${directionWord} the number of figures in the third cell is the sum of the first two.`
      : `Each ${directionWord}: third = first minus second.`
    return [
      {
        id: 'R6',
        axis: SHAPE_AXIS,
        direction: 'both',
        params: { values: [...params.shapeSet], rowOffset: params.rowOffset },
        statement: `Outer shape forms a Latin square: each of ${params.shapeSet.join(', ')} appears exactly once per row and once per column.`,
      },
      {
        id: 'R12',
        axis: COUNT_AXIS,
        direction: params.direction,
        params: { op: params.op },
        statement,
      },
    ]
  },
  radicals: { ruleCount: 2, ruleIds: ['R6', 'R12'], crossLayer: false, perceptualLoad: 1, elementTypes: 2, nearMissCount: 3 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 },
  distractorPlan: ['IR', 'IR', 'WR', 'PM', 'PM'],
  sampleParams(rng: Rng): LRMSumParams {
    // Rejection-sample until we find a grid-safe combination
    for (let attempt = 0; attempt < 2000; attempt++) {
      // Pick a random 3-set from the 6 shapes: shuffle and take first 3
      const shuffled = rng.shuffle(ALL_SHAPES)
      const shapeSet = shuffled.slice(0, 3) as [ShapeId, ShapeId, ShapeId]
      const rowOffset = rng.pick([1, 2] as const)
      const op = rng.int(0, 2) < 2 ? 'sum' : 'difference'
      const direction = rng.pick(['row_operator', 'column_operator'] as const)
      const fill = rng.pick(['solid', 'grey'] as const)

      // Generate operands
      // We need 6 operands: 3 rows × 2 operands per row
      // Each operand a_i, b_i in 1..5
      // Derived c_i = a_i + b_i ≤ 6 (sum) or c_i = a_i − b_i ≥ 1 (difference)
      const operands: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0]
      let valid = true

      // Generate 3 operand pairs with constraints
      const pairs: [number, number][] = []
      for (let row = 0; row < 3; row++) {
        let pairValid = false
        for (let pAttempt = 0; pAttempt < 50; pAttempt++) {
          const a = rng.int(1, 5)
          const b = rng.int(1, 5)
          const c = op === 'sum' ? a + b : a - b
          if (op === 'sum' && c > 6) continue
          if (op === 'difference' && c < 1) continue
          pairs.push([a, b])
          pairValid = true
          break
        }
        if (!pairValid) {
          valid = false
          break
        }
      }

      if (!valid) continue

      // Assign operands to flat array
      operands[0] = pairs[0][0]
      operands[1] = pairs[0][1]
      operands[2] = pairs[1][0]
      operands[3] = pairs[1][1]
      operands[4] = pairs[2][0]
      operands[5] = pairs[2][1]

      const params: LRMSumParams = { shapeSet, rowOffset, op, direction, fill, operands }

      // Key count validity
      const k = countAt(operands, op, direction, 3, 3)
      if (k < 1 || k > 6) continue

      // Prevent accidental constant diagonal
      const diag1 = countAt(operands, op, direction, 1, 1)
      const diag2 = countAt(operands, op, direction, 2, 2)
      const diag3 = countAt(operands, op, direction, 3, 3)
      if (diag1 === diag2 && diag2 === diag3) continue

      // Prevent accidental constant row/column when derived
      // If we're using row_operator, rows 1 & 2 are free but row 3 could be constant
      // If we're using column_operator, columns 1 & 2 are free but column 3 could be constant
      let hasDegenerate = false

      // Check all rows and columns for full constancy
      for (let i = 1; i <= 3; i++) {
        // Row i
        const row_vals = [countAt(operands, op, direction, i, 1), countAt(operands, op, direction, i, 2), countAt(operands, op, direction, i, 3)]
        if (row_vals[0] === row_vals[1] && row_vals[1] === row_vals[2]) {
          hasDegenerate = true
          break
        }
        // Column i
        const col_vals = [countAt(operands, op, direction, 1, i), countAt(operands, op, direction, 2, i), countAt(operands, op, direction, 3, i)]
        if (col_vals[0] === col_vals[1] && col_vals[1] === col_vals[2]) {
          hasDegenerate = true
          break
        }
      }

      if (hasDegenerate) continue

      // 2 ≤ k ≤ 5 so wrong counts exist on both sides of the key (G-09's
      // bulk-extremum rule), and the key's count appears somewhere among the
      // eight visible counts (keeps the key's G-11/G-19 class populated).
      if (k < 2 || k > 5) continue
      const visibleCounts = new Set<number>()
      for (let r = 1; r <= 3; r++) for (let c = 1; c <= 3; c++) if (!(r === 3 && c === 3)) visibleCounts.add(countAt(operands, op, direction, r, c))
      if (!visibleCounts.has(k)) continue

      // G-12: no two visible cells identical (same shape AND count), and the
      // key cell not identical to a visible cell — the Latin square repeats
      // shapes and operand counts repeat, so this bites a real fraction of
      // draws; cheaper to redraw here than to lose the item at the gate.
      const visible = buildContextCells(params).map((elements) => ({ elements }))
      let dup = false
      for (let i = 0; i < visible.length && !dup; i++) for (let j = i + 1; j < visible.length; j++) if (cellEq(visible[i], visible[j])) { dup = true; break }
      if (dup) continue
      const keyCell = { elements: repeatCell(k, shapeAt(shapeSet, rowOffset, 3, 3), fill) }
      if (visible.some((v) => cellEq(v, keyCell))) continue

      // Level A, for real: progressions, R12 in both directions and the
      // accidental-regularity probes must all agree on (3,3) — or redraw.
      if (!isGridSafe(params)) continue

      return params
    }

    throw new Error('LRM-SUM: sampleParams could not find a valid combination in 2000 attempts')
  },
  buildCell(values, params) {
    const shape = values[SHAPE_AXIS]
    const count = values[COUNT_AXIS]
    if (shape.t !== 'enum' || count.t !== 'num') throw new Error('shape/count must be enum/num')
    return repeatCell(count.v, shape.v as ShapeId, params.fill)
  },
  buildDistractors(ctx: DistractorCtx<LRMSumParams>) {
    const keyShape = ctx.valueAt(SHAPE_AXIS, 3, 3)
    const keyCount = ctx.valueAt(COUNT_AXIS, 3, 3)
    if (keyShape.t !== 'enum' || keyCount.t !== 'num') throw new Error('shape/count must be enum/num')

    const k = keyCount.v
    const s = keyShape.v as ShapeId

    // Get shape at R3C2 and the third shape in the set
    const s_alt = shapeAt(ctx.params.shapeSet, ctx.params.rowOffset, 3, 2) as ShapeId
    const allShapes = new Set(ctx.params.shapeSet)
    const s_alt2 = [...allShapes].find((sh) => sh !== s && sh !== s_alt) as ShapeId

    // Build a set of operand and derived values for distractor selection
    const allCounts = new Set<number>()
    const { operands, op, direction } = ctx.params
    for (let r = 1; r <= 3; r++) {
      for (let c = 1; c <= 3; c++) {
        allCounts.add(countAt(operands, op, direction, r, c))
      }
    }

    // Compute candidate wrong counts in priority order
    // All must be within ±2 of the key to satisfy the COMPLEXITY_OUTLIER check
    const wrongCounts: number[] = []

    // w1: opposite operation result (prioritize if within bounds)
    const oppositeResult = op === 'sum' ? operands[4] - operands[5] : operands[4] + operands[5]
    if (oppositeResult !== k && oppositeResult >= 1 && oppositeResult <= 6 && Math.abs(oppositeResult - k) <= 2) {
      wrongCounts.push(oppositeResult)
    }

    // w2: copy a_3 (first operand of row 3 / col 3)
    const a3 = operands[4]
    if (a3 !== k && !wrongCounts.includes(a3) && Math.abs(a3 - k) <= 2) {
      wrongCounts.push(a3)
    }

    // w3: copy b_3 (second operand of row 3 / col 3)
    const b3 = operands[5]
    if (b3 !== k && !wrongCounts.includes(b3) && Math.abs(b3 - k) <= 2) {
      wrongCounts.push(b3)
    }

    // Offsets: ±1, ±2
    const offsets = [1, -1, 2, -2]
    for (const offset of offsets) {
      const candidate = k + offset
      if (candidate >= 1 && candidate <= 6 && candidate !== k && !wrongCounts.includes(candidate)) {
        wrongCounts.push(candidate)
        if (wrongCounts.length >= 3) break
      }
    }

    // Ensure we have exactly 3 wrong counts (all within ±2 of k)
    while (wrongCounts.length < 3) {
      // Fallback: any count from allCounts that isn't k and is within ±2
      for (const c of allCounts) {
        if (c !== k && !wrongCounts.includes(c) && Math.abs(c - k) <= 2) {
          wrongCounts.push(c)
          break
        }
      }
      if (wrongCounts.length < 3) {
        // Last resort: pick from 1..6 within ±2 bound
        for (let i = Math.max(1, k - 2); i <= Math.min(6, k + 2); i++) {
          if (i !== k && !wrongCounts.includes(i)) {
            wrongCounts.push(i)
            break
          }
        }
      }
    }

    const [c1, c2, c3] = wrongCounts.slice(0, 3)

    // Compute distractor labels based on which wrong count this is
    const computeLabel = (wrongCount: number): string => {
      if (wrongCount === oppositeResult) return 'WR wrongRule:oppositeOperation'
      if (wrongCount === a3) return 'IR stall:outer.count@pos1'
      if (wrongCount === b3) return 'IR stall:outer.count@pos2'
      const offset = wrongCount - k
      return `WR offBy:${offset > 0 ? '+' : ''}${offset}`
    }

    // Build distractors
    const distractors: DistractorCandidate[] = []

    // D1: (s*, c1)
    distractors.push({
      elements: repeatCell(c1, s, ctx.params.fill),
      label: 'IR',
      mechanism: computeLabel(c1),
      wrongAxes: [COUNT_AXIS],
    })

    // D2: (s*, c2)
    distractors.push({
      elements: repeatCell(c2, s, ctx.params.fill),
      label: 'IR',
      mechanism: computeLabel(c2),
      wrongAxes: [COUNT_AXIS],
    })

    // D3: (s*, c3)
    distractors.push({
      elements: repeatCell(c3, s, ctx.params.fill),
      label: 'WR',
      mechanism: computeLabel(c3),
      wrongAxes: [COUNT_AXIS],
    })

    // D4: (s_alt, c1)
    distractors.push({
      elements: repeatCell(c1, s_alt, ctx.params.fill),
      label: 'PM',
      mechanism: `incompleteCorrelate:wrongShape+${computeLabel(c1)}`,
      wrongAxes: [SHAPE_AXIS, COUNT_AXIS],
    })

    // D5: (s_alt2, c1) — shares D1's count (see header: G-10)
    distractors.push({
      elements: repeatCell(c1, s_alt2, ctx.params.fill),
      label: 'PM',
      mechanism: `incompleteCorrelate:wrongShape2+${computeLabel(c1)}`,
      wrongAxes: [SHAPE_AXIS, COUNT_AXIS],
    })

    return distractors
  },
  nonCardinalAsymmetricRotation: () => false,
  structuralExtra: (params: LRMSumParams) => ({
    shapeSet: params.shapeSet,
    rowOffset: params.rowOffset,
    op: params.op,
    direction: params.direction,
    fill: params.fill,
  }),
}
