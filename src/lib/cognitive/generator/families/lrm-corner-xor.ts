/**
 * LRM-CORNER-XOR — XOR on four corner marks (hard, R7) × Latin square on a
 * centre shape (cheap, R6), cross-layer.
 *
 * SURFACE: Two elements per cell. The `dots` element on layer `satellite`
 * places solid S-sized marks at a subset of four corners {TL,TR,BL,BR}, never
 * at CTR; the `shape` element on layer `inner` places an M-sized centre shape
 * with fill constant per item (outline, hatched, or grey). Shape is drawn
 * from a per-item Latin 3-set — a cyclic permutation of three shapes from
 * {circle, square, triangle, diamond, pentagon, hexagon, star, cross}.
 *
 * RULES (axes in order):
 * R6 (inner.shape, cheap): Latin square. Each of the three shapes in the
 *     set appears exactly once per row and once per column.
 * R7 (satellite.anchors, hard): Symmetric difference on corner sets, row-wise.
 *     The third cell in each row contains exactly the corners that appear in
 *     exactly one of the first two cells.
 *
 * CONSTRUCTION: The grid is sampled by rejection: for each row, operand
 * corner sets (a_i, b_i) are drawn from {0,1,2,3} (TL, TR, BL, BR) with
 * |a_i|, |b_i| ∈ {1,2,3}, a_i ≠ b_i, and |a_i △ b_i| ∈ {1,2,3}. The result
 * a_i △ b_i must have at least 4 corners total across visible cells (a Level
 * A check: columnOperatorCoincidence avoids rival column readings). The three
 * XOR results must not all equal (to satisfy G-09 complexity spread), the
 * three operand pairs must not all be identical, and the shape Latin must be
 * non-trivial (not a constant column). The key's corner count |k| must appear
 * as the corner count of some visible cell (census requirement for G-19).
 *
 * DISTRACTOR LOGIC (six options; distractorPlan: ['WR','RP','RP','WR','PM']):
 * D1: (shape s*, corners w_union = a_3 ∪ b_3)           — wrongRule:union
 * D2: (shape s*, corners w_c1 = a_3)                    — copyCell:R3C1
 * D3: (shape s*, corners w_c2 = b_3)                    — copyCell:R3C2
 * D4: (shape s*, corners w_inter/w_diff)                — wrongRule:intersection/difference
 * D5: (shape s_alt = shape at R3C2, corners w_union)    — incompleteCorrelate:wrongShape+union
 *     (the ONE option wrong on the cheap axis: the shape Latin square has
 *     to be applied once, or the item's R6 would be decoration)
 * Fallback (when the planned set fails a gate): a pool search that may
 * substitute an incomplete (key ± one corner) or another grid cell.
 *
 * CONTRACT VERIFICATION (G-08'):
 * Modal computation (set-valued axes: per-element majority > N/2 = > 3 of 6).
 * Shape modal: s* appears in key, D1–D4 (5 times); s_alt in D5 (1 time).
 * Modal shape = s*. Corner modals are per-position (each of 4 corner
 * anchors). The union a_3 ∪ b_3 and both operands a_3, b_3 appear in
 * distractors; the XOR (key) appears only once. For a rich operand space
 * (e.g. a_3={0,1}, b_3={1,2}), union={0,1,2} and individual corner 1
 * appears in D1 (union), D2 (a_3), D3 (b_3) = 3 votes, so its modal is
 * YES. But corner 0 appears in D1 and D2 = 2 votes, corner 3 only in D1 = 1
 * vote. The key {0,3} matches neither the all-modal nor any single-error
 * copy, so modal hit rate stays low. Centroid (option distances from key):
 * D1 differs in corners only (distance 1 on corners, 0 on shape = 1 total);
 * D2 and D3 each differ on corners (distance ≥ 1); D5 differs on shape and
 * corners; D6 differs on corners only. Complexity spread (element counts)
 * stays at 0 (all six options have 2 elements).
 *
 * PREDICTED-B (difficulty.ts formula, non-cardinal asymmetric rotation = false):
 * Base: -2.0
 * Hard rule R7 (XOR, weight 1.6): +1.6
 * Cheap rule R6 (Latin square, discount 0.45): +0.45
 * ruleCount 2 contribution: +0.5
 * Cross-layer: +0.5
 * Perceptual load 1: +0.3
 * Total: -2.0 + 1.6 + 0.45 + 0.5 + 0.5 + 0.3 = +1.35 → band: hard.
 *
 * G-20 & G-18: cheap axis = inner.shape. Key and D1–D4 carry key shape (s*);
 * D5 alone differs on shape. Cheap elimination leaves 5/6 options ✓.
 * G-19: all corner counts and all shapes drawn from the grid ✓; key's class
 * (twin vs novel, in-vocab vs unseen) must include at least one distractor.
 * G-09: all six options distinct under cellEq; complexity spread ≤ 2 (all
 * have 2 elements) ✓; key not the sole bulk extremum by count.
 *
 * LITERATURE: XOR/"figure addition–subtraction with cancellation" (Carpenter
 * et al. 1990, Kyllonen & Christal 1990); BOLT matrices on symmetric
 * difference (Schroeders & Walter 2026); HeiQ facet design on the Latin
 * square (Reckase & Revuelta 2020). Cross-layer as per LRM-2R-XLAYER and
 * LRM-XOR-XLAYER precedent.
 */

import type { Anchor, Element, RuleSpec, ShapeId } from '../../spec/schema'
import { enumVal, setVal } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx, DistractorCandidate } from '../compose'
import type { Rng } from '../rng'
import { contextBlindGate, giveawayPairGate } from '../qa/contextblind'
import { copyEliminationOk, eliminationResistanceOk, optionComplexitySpreadCheck, keyBulkExtremumCheck } from '../qa/degeneracy'
import { cellEq } from '../axes'
import { uniquelySolvable } from './bitgrid'

const SHAPE_AXIS = 'inner.shape'
const ANCHORS_AXIS = 'satellite.anchors'

// Four corners: TL=0, TR=1, BL=2, BR=3
type Corner = 0 | 1 | 2 | 3
const ALL_CORNERS: readonly Corner[] = [0, 1, 2, 3]

// Available shape sets for Latin squares (three shapes each)
const SHAPE_SETS = [
  ['circle', 'square', 'triangle'],
  ['circle', 'triangle', 'diamond'],
  ['square', 'diamond', 'pentagon'],
  ['triangle', 'pentagon', 'hexagon'],
  ['diamond', 'hexagon', 'star'],
  ['pentagon', 'star', 'cross'],
  ['hexagon', 'cross', 'circle'],
  ['star', 'circle', 'square'],
] as const

const FILLS = ['outline', 'hatched', 'grey'] as const

export interface CornerXorRow {
  a: Corner[]
  b: Corner[]
}

export interface CornerXorParams {
  shapeSet: readonly [ShapeId, ShapeId, ShapeId]
  shapeStart: 0 | 1 | 2
  shapeRowOffset: 1 | 2
  innerFill: 'outline' | 'hatched' | 'grey'
  direction: 'row_operator' | 'column_operator'
  rows: [CornerXorRow, CornerXorRow, CornerXorRow]
}

function cornerXor(a: readonly Corner[], b: readonly Corner[]): Corner[] {
  const A = new Set(a)
  const B = new Set(b)
  return sortCorners([...a.filter((x) => !B.has(x)), ...b.filter((x) => !A.has(x))])
}

function sortCorners(xs: readonly Corner[]): Corner[] {
  return [...new Set(xs)].sort((a, b) => a - b) as Corner[]
}

function cornersAt(params: CornerXorParams, row: number, col: number): Corner[] {
  const r = params.rows[row - 1]
  if (col === 1) return r.a
  if (col === 2) return r.b
  if (col === 3) return cornerXor(r.a, r.b)
  throw new Error(`Invalid column ${col}`)
}

function cyclicShapeIndex(shapeSet: readonly unknown[], start: number, rowOffset: number, row: number, col: number): number {
  const idx = (((start + (col - 1) + rowOffset * (row - 1)) % 3) + 3) % 3
  return idx
}

function shapeAt(params: CornerXorParams, row: number, col: number): ShapeId {
  const idx = cyclicShapeIndex(params.shapeSet, params.shapeStart, params.shapeRowOffset, row, col)
  return params.shapeSet[idx] as ShapeId
}

function cornerToAnchor(c: Corner): Anchor {
  const anchors: Record<Corner, Anchor> = { 0: 'TL', 1: 'TR', 2: 'BL', 3: 'BR' }
  return anchors[c]
}

function cell(anchors: readonly Corner[], shape: ShapeId, fill: 'outline' | 'hatched' | 'grey'): Element[] {
  return [
    {
      type: 'dots',
      layer: 'satellite',
      anchors: anchors.map(cornerToAnchor),
      fill: 'solid' as const,
      size: 'S' as const,
    } as Element,
    {
      type: 'shape',
      layer: 'inner',
      shape,
      fill: fill,
      size: 'M' as const,
      anchor: 'CTR' as const,
      rotation: 0,
    } as Element,
  ]
}

/**
 * Rejection sampling: each row draws operand pairs with size 1–3 and
 * non-empty XOR. Key's corner count must appear in grid. Grid must be
 * uniquely solvable under Level A.
 */
function sampleRows(rng: Rng): CornerXorParams['rows'] {
  for (let attempt = 0; attempt < 300; attempt++) {
    const rows = [0, 1, 2].map(() => {
      // Draw |a|, |b| from {1,2,3} independently; reject if a == b or if XOR is empty.
      let a: Corner[] = []
      let b: Corner[] = []
      let aSize = 0
      let bSize = 0
      let xySize = 0
      for (let sub = 0; sub < 100; sub++) {
        aSize = (rng.int(0, 2) + 1) as 1 | 2 | 3
        bSize = (rng.int(0, 2) + 1) as 1 | 2 | 3
        a = sortCorners(rng.shuffle([...ALL_CORNERS]).slice(0, aSize) as Corner[])
        b = sortCorners(rng.shuffle([...ALL_CORNERS]).slice(0, bSize) as Corner[])
        const xy = cornerXor(a, b)
        xySize = xy.length
        if (a !== b && xySize > 0 && xySize <= 3 && !sameCorners(a, b)) break
      }
      if (aSize === 0 || bSize === 0 || xySize === 0 || xySize > 3) return null
      return { a, b }
    }) as Array<CornerXorRow | null>

    if (rows.some((r) => r === null)) continue

    const validRows = rows as CornerXorParams['rows']
    const key = cornerXor(validRows[2].a, validRows[2].b)
    const visible: Corner[][] = []
    for (let r = 0; r < 3; r++) {
      visible.push(validRows[r].a, validRows[r].b)
      if (r < 2) visible.push(cornerXor(validRows[r].a, validRows[r].b))
    }

    // Check key ≠ all visible cells
    let ok = true
    for (let i = 0; i < visible.length && ok; i++) {
      if (sameCorners(visible[i], key)) ok = false
      for (let j = i + 1; j < visible.length && ok; j++) if (sameCorners(visible[i], visible[j])) ok = false
    }

    // Level A: build the grid cells and check uniquelySolvable.
    if (ok) {
      const at = (c: 1 | 2 | 3, r: 1 | 2 | 3): readonly Corner[] =>
        c === 1 ? validRows[r - 1].a : c === 2 ? validRows[r - 1].b : cornerXor(validRows[r - 1].a, validRows[r - 1].b)
      // Build a dummy grid for Level A check. We'll use shape/anchors axes.
      const cells = ([1, 2, 3] as const)
        .flatMap((r) =>
          ([1, 2, 3] as const)
            .filter((c) => !(r === 3 && c === 3))
            .map((c) => ({
              row: r,
              col: c,
              elements: [
                {
                  type: 'dots' as const,
                  layer: 'satellite' as const,
                  anchors: at(c, r).map(cornerToAnchor),
                  fill: 'solid' as const,
                  size: 'S' as const,
                } as Element,
              ],
            }))
        )
      if (!uniquelySolvable(cells, [ANCHORS_AXIS], { [ANCHORS_AXIS]: { kind: 'set' } as AxisDomain })) ok = false
    }

    // Check that key's corner count appears in the grid.
    if (ok) {
      const keyCount = key.length
      const gridCounts = new Set<number>()
      for (let r = 1; r <= 3; r++) {
        for (let c = 1; c <= 3; c++) {
          if (r === 3 && c === 3) continue
          gridCounts.add(cornersAt(
            {
              shapeSet: ['circle', 'square', 'triangle'] as const,
              shapeStart: 0,
              shapeRowOffset: 1,
              innerFill: 'outline',
              direction: 'row_operator',
              rows: validRows,
            },
            r,
            c
          ).length)
        }
      }
      if (!gridCounts.has(keyCount)) ok = false
    }

    if (ok) return validRows
  }
  throw new Error('LRM-CORNER-XOR: could not sample a distinct grid in 300 attempts')
}

function sameCorners(a: readonly Corner[], b: readonly Corner[]): boolean {
  const A = sortCorners(a)
  const B = sortCorners(b)
  return A.length === B.length && A.every((x, i) => x === B[i])
}

function cornersSetVal(xs: readonly Corner[]): ReturnType<typeof setVal> {
  return setVal(sortCorners(xs).map((x) => String(x)))
}

function fromCornersSetVal(v: ReturnType<typeof setVal>): Corner[] {
  if (v.t !== 'set') throw new Error('corner axis value must be a set')
  return sortCorners(v.v.map((x) => Number.parseInt(x, 10)) as Corner[])
}

export const LRM_CORNER_XOR: FamilyTemplate<CornerXorParams> = {
  code: 'LRM-CORNER-XOR',
  axes: [SHAPE_AXIS, ANCHORS_AXIS],
  cheapAxes: [SHAPE_AXIS],
  domains: () => ({
    [SHAPE_AXIS]: { kind: 'unordered-enum' } as AxisDomain,
    [ANCHORS_AXIS]: { kind: 'set' } as AxisDomain,
  }),
  valueAt: (axis, row, col, params) => {
    if (axis === SHAPE_AXIS) return enumVal(shapeAt(params, row, col))
    if (axis === ANCHORS_AXIS) return cornersSetVal(cornersAt(params, row, col))
    throw new Error(`unknown axis ${axis}`)
  },
  ruleSpecs: (params): RuleSpec[] => [
    {
      id: 'R6',
      axis: SHAPE_AXIS,
      direction: 'both',
      params: {
        values: [...params.shapeSet],
        rowOffset: params.shapeRowOffset,
      },
      statement: `Inner shape forms a Latin square: each of ${params.shapeSet.join(', ')} appears exactly once per row and once per column.`,
    },
    {
      id: 'R7',
      axis: ANCHORS_AXIS,
      direction: 'row_operator',
      params: { op: 'symdiff' },
      statement: 'The corner marks in the third cell of each row are exactly those that appear in exactly one of the first two cells (their symmetric difference).',
    },
  ],
  radicals: {
    ruleCount: 2,
    ruleIds: ['R6', 'R7'],
    crossLayer: true,
    perceptualLoad: 1,
    elementTypes: 3,
    nearMissCount: 3,
  },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 },
  distractorPlan: ['WR', 'RP', 'RP', 'WR', 'PM'],
  sampleParams(rng: Rng): CornerXorParams {
    const shapeSet = rng.pick(SHAPE_SETS)
    const shapeStart = rng.int(0, 2) as 0 | 1 | 2
    const shapeRowOffset = rng.pick([1, 2] as const)
    const innerFill = rng.pick(FILLS)
    const rows = sampleRows(rng)
    return {
      shapeSet: shapeSet as readonly [ShapeId, ShapeId, ShapeId],
      shapeStart,
      shapeRowOffset,
      innerFill: innerFill as 'outline' | 'hatched' | 'grey',
      direction: 'row_operator',
      rows,
    }
  },
  buildCell(values, params) {
    const shape = values[SHAPE_AXIS]
    const anchors = values[ANCHORS_AXIS]
    if (shape.t !== 'enum' || anchors.t !== 'set') throw new Error('shape/anchors must be enum/set')
    return cell(fromCornersSetVal(anchors), shape.v as ShapeId, params.innerFill)
  },
  buildDistractors(ctx: DistractorCtx<CornerXorParams>) {
    const keyCorners = fromCornersSetVal(ctx.valueAt(ANCHORS_AXIS, 3, 3))
    const keyShape = ctx.valueAt(SHAPE_AXIS, 3, 3)
    if (keyShape.t !== 'enum') throw new Error('shape must be enum')
    const keyShapeId = keyShape.v as ShapeId

    const c1 = fromCornersSetVal(ctx.valueAt(ANCHORS_AXIS, 3, 1))
    const c2 = fromCornersSetVal(ctx.valueAt(ANCHORS_AXIS, 3, 2))

    const r3c2Shape = ctx.valueAt(SHAPE_AXIS, 3, 2)
    if (r3c2Shape.t !== 'enum') throw new Error('shape must be enum')

    const mk = (corners: readonly Corner[], shape: ShapeId, label: 'WR' | 'IR' | 'PM' | 'RP', mechanism: string): DistractorCandidate => ({
      elements: cell(corners, shape, ctx.params.innerFill),
      label,
      mechanism,
      wrongAxes: sameCorners(corners, keyCorners) && shape === keyShapeId ? [] : (shape === keyShapeId ? [ANCHORS_AXIS] : sameCorners(corners, keyCorners) ? [SHAPE_AXIS] : [SHAPE_AXIS, ANCHORS_AXIS]),
    })

    const contextCells = ctx.grid.map((gc) => ({ elements: gc.elements }))

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

    // Deterministic construction per plan: ['WR', 'RP', 'RP', 'WR', 'PM']
    // D1: union; D2: copy c1; D3: copy c2; D4: intersection (if non-empty)
    // else difference; D5: the incomplete correlate — R3C2's shape with the
    // union corners (wrong on the cheap axis, shares D1's hard value).

    const union = sortCorners([...c1, ...c2])
    const inter = sortCorners(c1.filter((x) => c2.includes(x)))
    const diff = sortCorners(c1.filter((x) => !c2.includes(x)))
    const diffRev = sortCorners(c2.filter((x) => !c1.includes(x)))

    // Try primary construction
    const d1 = mk(union, keyShapeId, 'WR', 'wrongRule:union')
    const d2 = mk(c1, keyShapeId, 'RP', 'copyCell:R3C1')
    const d3 = mk(c2, keyShapeId, 'RP', 'copyCell:R3C2')

    let d4: DistractorCandidate | null = null
    if (inter.length > 0 && !sameCorners(inter, keyCorners)) {
      d4 = mk(inter, keyShapeId, 'WR', 'wrongRule:intersection')
    } else if (diff.length > 0 && !sameCorners(diff, keyCorners)) {
      d4 = mk(diff, keyShapeId, 'WR', 'wrongRule:difference')
    } else if (diffRev.length > 0 && !sameCorners(diffRev, keyCorners)) {
      d4 = mk(diffRev, keyShapeId, 'WR', 'wrongRule:reverseDifference')
    }

    // D5: incomplete correlate — the shape at R3C2 (≠ key shape under the
    // Latin square, in-vocab) carrying D1's union corners.
    const altShapeId = r3c2Shape.v as ShapeId
    const d5 = mk(union, altShapeId, 'PM', 'incompleteCorrelate:wrongShape+union')

    if (d4) {
      const cands = [d1, d2, d3, d4, d5]
      if (validSet(cands)) return cands
    }
    // Second try: swap D4 for an incomplete (key minus one corner) when the
    // planned set fails a gate.
    for (const corner of keyCorners) {
      const incomplete = sortCorners(keyCorners.filter((c) => c !== corner))
      if (incomplete.length === 0) continue
      const cands = [d1, d2, d3, mk(incomplete, keyShapeId, 'IR', `incomplete:keyMinusOne_${corner}`), d5]
      if (validSet(cands)) return cands
    }

    // Fallback: search grid cells and other combinations for a full 5-distractor set
    const pool: Array<{ corners: Corner[]; shape: ShapeId; label: 'IR' | 'WR' | 'RP' | 'PM'; mech: string }> = [
      { corners: union, shape: keyShapeId, label: 'WR', mech: 'wrongRule:union' },
      { corners: c1, shape: keyShapeId, label: 'RP', mech: 'copyCell:R3C1' },
      { corners: c2, shape: keyShapeId, label: 'RP', mech: 'copyCell:R3C2' },
    ]

    if (inter.length > 0) pool.push({ corners: inter, shape: keyShapeId, label: 'WR', mech: 'wrongRule:intersection' })
    if (diff.length > 0) pool.push({ corners: diff, shape: keyShapeId, label: 'WR', mech: 'wrongRule:difference' })

    for (const corner of keyCorners) {
      const incomplete = sortCorners(keyCorners.filter((c) => c !== corner))
      if (incomplete.length > 0) pool.push({ corners: incomplete, shape: keyShapeId, label: 'IR', mech: `incomplete:keyMinusOne_${corner}` })
    }

    for (const corner of ALL_CORNERS) {
      if (!keyCorners.includes(corner)) {
        const extended = sortCorners([...keyCorners, corner])
        if (extended.length <= 4) pool.push({ corners: extended, shape: keyShapeId, label: 'IR', mech: `incomplete:keyPlusOne_${corner}` })
      }
    }

    for (const gc of ctx.grid) {
      const corners = fromCornersSetVal(ctx.valueAt(ANCHORS_AXIS, gc.row, gc.col))
      const shape = ctx.valueAt(SHAPE_AXIS, gc.row, gc.col)
      if (shape.t === 'enum') {
        pool.push({ corners, shape: shape.v as ShapeId, label: 'PM', mech: `copyCell:R${gc.row}C${gc.col}` })
      }
    }

    // Filter out key-equivalent and duplicates
    const uniq: typeof pool = []
    for (const p of pool) {
      if (!uniq.some((u) => sameCorners(u.corners, p.corners) && u.shape === p.shape) && !(sameCorners(p.corners, keyCorners) && p.shape === keyShapeId)) {
        uniq.push(p)
      }
    }

    // Try all 5-element combinations
    for (let i = 0; i < uniq.length; i++) {
      for (let j = i + 1; j < uniq.length; j++) {
        for (let k = j + 1; k < uniq.length; k++) {
          for (let l = k + 1; l < uniq.length; l++) {
            for (let m = l + 1; m < uniq.length; m++) {
              const cands = [uniq[i], uniq[j], uniq[k], uniq[l], uniq[m]].map((p) =>
                mk(p.corners, p.shape, p.label, p.mech)
              )
              if (validSet(cands)) return cands
            }
          }
        }
      }
    }

    throw new Error(`LRM-CORNER-XOR: no distractor construction cleared the gates`)
  },
  nonCardinalAsymmetricRotation: () => false,
  structuralExtra: (params: CornerXorParams) => ({
    shapeSet: params.shapeSet,
    shapeStart: params.shapeStart,
    shapeRowOffset: params.shapeRowOffset,
    innerFill: params.innerFill,
    rows: params.rows.map((r) => ({ a: sortCorners(r.a), b: sortCorners(r.b) })),
  }),
}
