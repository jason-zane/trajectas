/**
 * LRM-DOTS-AND — R11 intersection (AND) on five-anchor dot patterns, moderate
 * difficulty. Build-plan 2026-08-19-cognitive-v2-build-plan.md §2; literature
 * hook: Boolean figural matrices (BOLT; Carpenter et al. 1990). Doc
 * 03-logical-reasoning-design.md calls this the "logical AND" variant of
 * figure addition/subtraction — row 3's dots are those that appear in BOTH
 * row 1 AND row 2.
 *
 * CONSTRUCTION. Each row draws its own operand pair from the five anchors
 * {TL, TR, BL, BR, CTR} — |c1|, |c2| ∈ {2,3,4}, |c1 ∩ c2| ∈ {1,2} so the
 * intersection is non-empty, c1 ≠ c2, c1 ⊄ c2 and c2 ⊄ c1 (intersection ≠
 * either operand). The three intersections are not all equal. No operand pair
 * is repeated verbatim across lines. The grid's eight visible cells are
 * pairwise distinct and distinct from the key; `uniquelySolvable` verifies
 * R11 as the unique row reading before accepting the draw.
 *
 * OPTION SET (N=6, single hard axis, five distractors): key is c1 ∩ c2 at
 * (3,3). Distractor plan by priority:
 *   1. WR wrongRule:union — c1 ∪ c2 (confusion: AND becomes OR)
 *   2. WR wrongRule:difference — c1 − c2 (if non-empty; confusion: AND becomes set subtraction)
 *   3. WR wrongRule:symdiff — c1 △ c2 (confusion: AND becomes XOR)
 *   4. RP copyCell:R3C1 — c1 itself (operand persistence / top-down reading)
 *   5. RP copyCell:R3C2 — c2 itself (operand persistence / left-to-right reading)
 *   6. IR incomplete:keyPlusOneShared — k ∪ {one anchor from (c1 ∪ c2) − k}
 *   7. IR incomplete:keyMinusOne — k minus its last anchor (if |k| > 1)
 *   8. WR wrongRule:reverseDifference — c2 − c1
 *   9. RP copyCell:R2C3 — result from row 2
 *   10. PM fallback: any other in-vocab-count subset
 *
 * Take the first five that are distinct, non-key, and in-vocabulary, then
 * gate with `contextBlindGate` and `giveawayPairGate`. If the set fails
 * G-08′/G-10, replace the last picked candidate (victim) with the next in
 * the priority list until a set passes or the pool runs out.
 *
 * MODAL COMPOSITION (G-08′ context-blind gate): Per-anchor majority (> 3 of 6):
 * each anchor is "modal" if present in >= 4 options. The key's anchor set must
 * not equal the modal set exactly (ties broken by including the most options,
 * but key must not be the unique match). Example: if anchors {TL, TR} appear
 * in key + union + diff + reverse-diff (4 options), but {TL} (the intersection)
 * appears in all five wrong rules, then the modal set on TL is 5, on TR is 4,
 * and no other anchor hits the threshold; the modal composition is {TL} ≠ key,
 * so G-08′ passes. Centroid check: no option sits uniquely closest to the key
 * in anchor-set space (Hamming distance on presence/absence). G-10 giveaway
 * pair: no two options that together reveal the operation (e.g., first two
 * operand copies should not appear side-by-side in the six options).
 *
 * COPY CLASS (G-11): key is a copy iff some visible cell has exactly the set k.
 * If key is a copy, the mechanism counts as IR (incomplete rule) in the class;
 * if novel, it stands alone. The six options' classes: two RP copies (c1, c2),
 * and four non-copies (union, difference, symdiff, incomplete). After
 * eliminating copies (c1, c2), at least two non-copies remain (union,
 * difference, symdiff, incomplete), so G-11 ✓.
 *
 * IN-VOCABULARY (G-19): every distractor uses only anchor counts (and anchors
 * themselves) that appear in the grid's eight visible cells. Anchor counts
 * across the grid typically span {1,2,3,4}, and the key's |k| ∈ {1,2}; every
 * option's count is in-vocab. Anchors used: all five are likely drawn across
 * the three rows' operand pairs, so every anchor is in-vocab. The key's class
 * (copy, novel, in-vocab) must share members with at least one distractor.
 *
 * PERCEPTUAL LOAD: 1 (five distinct anchors = lower load than bit-grids' nine
 * positions). Radicals: ruleCount 1, ruleIds ['R11'], crossLayer false,
 * elementTypes 2 (just dots), nearMissCount 3. Predicted b = −2.0 + 0.8 + 0.3
 * = −0.9 (but formula yields ≈−0.75), band moderate.
 */
import type { Anchor, Element, RuleSpec } from '../../spec/schema'
import { setVal } from '../axes'
import type { AxisDomain } from '../rules'
import type { FamilyTemplate, DistractorCtx, DistractorCandidate } from '../compose'
import type { Rng } from '../rng'
import { contextBlindGate, giveawayPairGate } from '../qa/contextblind'
import { cellComplexity } from '../axes'

const AXIS = 'outer.anchors'
const ALL_ANCHORS: Anchor[] = ['TL', 'TR', 'BL', 'BR', 'CTR']

export interface DotsAndRow {
  c1: Anchor[]
  c2: Anchor[]
}
export interface DotsAndParams {
  /** One operand pair per grid row, index 0..2. */
  rows: [DotsAndRow, DotsAndRow, DotsAndRow]
  /** Fill style, constant for the item. */
  fill: 'solid' | 'hatched' | 'grey' | 'outline'
}

const OPERAND_SIZE_MIN = 2
const OPERAND_SIZE_MAX = 4
const OVERLAP_MIN = 1
const OVERLAP_MAX = 2

function resultOf(row: DotsAndRow): Anchor[] {
  const A = new Set(row.c1)
  return row.c2.filter((x) => A.has(x)).sort(anchorOrder)
}

function dotsCell(anchors: readonly Anchor[], fill: 'solid' | 'hatched' | 'grey' | 'outline'): Element[] {
  return [{ type: 'dots', layer: 'outer', anchors: [...anchors].sort(anchorOrder), fill, size: 'S' }]
}

const ANCHOR_ORDER: Record<Anchor, number> = { TL: 0, TR: 1, BL: 2, BR: 3, CTR: 4 }
function anchorOrder(a: Anchor, b: Anchor): number {
  return ANCHOR_ORDER[a] - ANCHOR_ORDER[b]
}

function sameSet(a: readonly Anchor[], b: readonly Anchor[]): boolean {
  const A = [...a].sort(anchorOrder)
  const B = [...b].sort(anchorOrder)
  return A.length === B.length && A.every((x, i) => x === B[i])
}

function unionSet(a: readonly Anchor[], b: readonly Anchor[]): Anchor[] {
  return [...new Set([...a, ...b])].sort(anchorOrder)
}

function minusSet(a: readonly Anchor[], b: readonly Anchor[]): Anchor[] {
  const B = new Set(b)
  return a.filter((x) => !B.has(x)).sort(anchorOrder)
}

/**
 * Sample an operand pair: both operands have size in [min, max], overlap in
 * [overlapMin, overlapMax], both are non-empty, and they don't contain each
 * other (neither is a subset of the other).
 */
function sampleOperandPair(rng: Rng, overlapMin: number, overlapMax: number, sizeMin: number, sizeMax: number): DotsAndRow {
  let attempt = 0
  while (attempt < 100) {
    attempt++
    const size1 = rng.int(sizeMin, sizeMax)
    const size2 = rng.int(sizeMin, sizeMax)
    const overlap = rng.int(overlapMin, Math.min(overlapMax, size1, size2))

    const pool = rng.shuffle([...ALL_ANCHORS])
    const shared = pool.slice(0, overlap)
    const rest = pool.slice(overlap)
    const only1 = rest.slice(0, size1 - overlap)
    const only2 = rest.slice(size1 - overlap, size1 - overlap + size2 - overlap)

    if (only1.length + shared.length !== size1 || only2.length + shared.length !== size2) continue

    const c1 = [...shared, ...only1].sort(anchorOrder)
    const c2 = [...shared, ...only2].sort(anchorOrder)

    // Neither is a subset of the other
    const c1set = new Set(c1)
    const c2set = new Set(c2)
    if (c1.every((x) => c2set.has(x)) || c2.every((x) => c1set.has(x))) continue

    return { c1, c2 }
  }
  throw new Error('LRM-DOTS-AND: could not sample operand pair in 100 attempts')
}

/**
 * Rejection sampling for a grid that is well-formed BEFORE distractors are
 * considered: the eight visible cells pairwise distinct as sets, the key
 * (row 3's result) distinct from every visible cell, the three intersections
 * not all equal.
 */
function sampleRows(rng: Rng): DotsAndParams['rows'] {
  for (let attempt = 0; attempt < 300; attempt++) {
    const rows = [0, 1, 2].map(() => sampleOperandPair(rng, OVERLAP_MIN, OVERLAP_MAX, OPERAND_SIZE_MIN, OPERAND_SIZE_MAX)) as DotsAndParams['rows']

    const key = resultOf(rows[2])
    const visible: Anchor[][] = []
    for (let r = 0; r < 3; r++) {
      visible.push(rows[r].c1, rows[r].c2)
      if (r < 2) visible.push(resultOf(rows[r]))
    }

    // Check: all visible cells distinct, key distinct from all visible
    let ok = true
    for (let i = 0; i < visible.length && ok; i++) {
      if (sameSet(visible[i], key)) ok = false
      for (let j = i + 1; j < visible.length && ok; j++) if (sameSet(visible[i], visible[j])) ok = false
    }

    // Check: the three intersections are not all equal
    if (ok) {
      const inter0 = resultOf(rows[0])
      const inter1 = resultOf(rows[1])
      const inter2 = resultOf(rows[2])
      if (sameSet(inter0, inter1) && sameSet(inter1, inter2)) ok = false
    }

    // Check: no operand pair repeated verbatim across lines
    if (ok) {
      const pairsAsSet = (row: DotsAndRow) => JSON.stringify({ c1: row.c1, c2: row.c2 })
      const seen = new Set<string>()
      for (const row of rows) {
        const key = pairsAsSet(row)
        if (seen.has(key)) ok = false
        seen.add(key)
      }
    }

    if (ok) return rows
  }
  throw new Error('LRM-DOTS-AND: could not sample a distinct grid in 300 attempts')
}

export const LRM_DOTS_AND: FamilyTemplate<DotsAndParams> = {
  code: 'LRM-DOTS-AND',
  axes: [AXIS],
  domains: () => ({ [AXIS]: { kind: 'set' } as AxisDomain }),
  valueAt: (axis, row, col, params) => {
    if (axis !== AXIS) throw new Error(`unknown axis ${axis}`)
    const r = params.rows[row - 1]
    if (col === 1) return setVal(r.c1)
    if (col === 2) return setVal(r.c2)
    return setVal(resultOf(r))
  },
  ruleSpecs: (): RuleSpec[] => [
    {
      id: 'R11',
      axis: AXIS,
      direction: 'row_operator',
      params: { op: 'intersection' },
      statement: 'In each row, the third cell shows only the dots that appear in BOTH the first and the second cell.',
    },
  ],
  radicals: { ruleCount: 1, ruleIds: ['R11'], crossLayer: false, perceptualLoad: 1, elementTypes: 2, nearMissCount: 3 },
  render: { styleVersion: 'v1', canvas: 100, strokeWidth: 2, hatchPitch: 4, minElementUnits: 8 },
  distractorPlan: ['WR', 'WR', 'WR', 'RP', 'RP'],
  sampleParams(rng: Rng): DotsAndParams {
    const rows = sampleRows(rng)
    const fills: Array<'solid' | 'hatched' | 'grey' | 'outline'> = ['solid', 'hatched', 'grey', 'outline']
    const fill = rng.pick(fills)
    return { rows, fill }
  },
  buildCell(values, params) {
    const v = values[AXIS]
    if (v.t !== 'set') throw new Error('outer.anchors must be a set')
    return dotsCell(v.v as Anchor[], params.fill)
  },
  buildDistractors(ctx: DistractorCtx<DotsAndParams>) {
    const key = ctx.valueAt(AXIS, 3, 3)
    if (key.t !== 'set') throw new Error('outer.anchors must be a set')
    const keyAnchors = key.v as Anchor[]

    const c1 = ctx.valueAt(AXIS, 3, 1)
    const c2 = ctx.valueAt(AXIS, 3, 2)
    if (c1.t !== 'set' || c2.t !== 'set') throw new Error('outer.anchors must be a set')

    const c1Anchors = c1.v as Anchor[]
    const c2Anchors = c2.v as Anchor[]
    const fill = ctx.params.fill

    const mk = (anchors: readonly Anchor[], label: 'IR' | 'WR' | 'RP' | 'PM', mechanism: string): DistractorCandidate => ({
      elements: dotsCell(anchors, fill),
      label,
      mechanism,
      wrongAxes: sameSet(anchors, keyAnchors) ? [] : [AXIS],
    })

    const validSet = (cands: DistractorCandidate[]): boolean => {
      if (cands.some((c) => c.wrongAxes.length === 0)) return false
      for (let i = 0; i < cands.length; i++) {
        for (let j = i + 1; j < cands.length; j++) {
          const e1 = cands[i].elements[0]
          const e2 = cands[j].elements[0]
          if (e1 && e2 && e1.type === 'dots' && e2.type === 'dots') {
            const a1 = e1.anchors || []
            const a2 = e2.anchors || []
            if (sameSet(a1, a2)) return false
          }
        }
      }
      const cells = [{ elements: ctx.keyCell.elements }, ...cands.map((c) => ({ elements: c.elements }))]
      const counts = cells.map(cellComplexity)
      const spreadOk = Math.max(...counts) - Math.min(...counts) <= 2
      if (!spreadOk) return false
      if (!contextBlindGate(cells, 0, ctx.axes).ok) return false
      return giveawayPairGate(cells, ctx.axes).ok
    }

    // Build a pool of candidate distractors in priority order
    const pool: DistractorCandidate[] = []

    // 1. WR wrongRule:union
    const unionAnchors = unionSet(c1Anchors, c2Anchors)
    pool.push(mk(unionAnchors, 'WR', 'wrongRule:union'))

    // 2. WR wrongRule:difference c1 - c2
    const diffAnchors = minusSet(c1Anchors, c2Anchors)
    if (diffAnchors.length > 0) pool.push(mk(diffAnchors, 'WR', 'wrongRule:difference'))

    // 3. WR wrongRule:symdiff
    const symdiffAnchors = [...c1Anchors.filter((x) => !c2Anchors.includes(x)), ...c2Anchors.filter((x) => !c1Anchors.includes(x))].sort(anchorOrder)
    pool.push(mk(symdiffAnchors, 'WR', 'wrongRule:symdiff'))

    // 4. RP copyCell:R3C1
    pool.push(mk(c1Anchors, 'RP', 'copyCell:R3C1'))

    // 5. RP copyCell:R3C2
    pool.push(mk(c2Anchors, 'RP', 'copyCell:R3C2'))

    // 6. IR incomplete:keyPlusOneShared
    const union = unionSet(c1Anchors, c2Anchors)
    const notInKey = union.filter((a) => !keyAnchors.includes(a))
    if (notInKey.length > 0 && keyAnchors.length > 0) {
      const extraAnchor = notInKey[0]
      const incompAnchors = [...keyAnchors, extraAnchor].sort(anchorOrder)
      pool.push(mk(incompAnchors, 'IR', 'incomplete:keyPlusOneShared'))
    }

    // 7. IR incomplete:keyMinusOne
    if (keyAnchors.length > 1) {
      const incompAnchors = keyAnchors.slice(0, keyAnchors.length - 1)
      pool.push(mk(incompAnchors, 'IR', 'incomplete:keyMinusOne'))
    }

    // 8. WR wrongRule:reverseDifference c2 - c1
    const revdiffAnchors = minusSet(c2Anchors, c1Anchors)
    if (revdiffAnchors.length > 0) pool.push(mk(revdiffAnchors, 'WR', 'wrongRule:reverseDifference'))

    // 9. RP copyCell:R2C3 (result from row 2)
    const row2Result = ctx.valueAt(AXIS, 2, 3)
    if (row2Result.t === 'set') {
      const row2Anchors = row2Result.v as Anchor[]
      pool.push(mk(row2Anchors, 'RP', 'copyCell:R2C3'))
    }

    // 10. Add grid cells as fallback options
    for (const gc of ctx.grid) {
      const v = ctx.valueAt(AXIS, gc.row, gc.col)
      if (v.t === 'set') {
        const anchors = v.v as Anchor[]
        pool.push(mk(anchors, 'PM', `copyCell:R${gc.row}C${gc.col}`))
      }
    }

    // Deduplicate pool by anchor set
    const uniqPool: DistractorCandidate[] = []
    const seen = new Set<string>()
    for (const p of pool) {
      const e = p.elements[0]
      if (e && e.type === 'dots') {
        const key = (e.anchors || []).sort(anchorOrder).join(',')
        if (!seen.has(key) && !sameSet(e.anchors || [], keyAnchors)) {
          seen.add(key)
          uniqPool.push(p)
        }
      }
    }

    // Deterministic search: try all 5-combinations of the pool
    for (let a = 0; a < uniqPool.length; a++) {
      for (let b = a + 1; b < uniqPool.length; b++) {
        for (let c = b + 1; c < uniqPool.length; c++) {
          for (let d = c + 1; d < uniqPool.length; d++) {
            for (let e = d + 1; e < uniqPool.length; e++) {
              const cands = [uniqPool[a], uniqPool[b], uniqPool[c], uniqPool[d], uniqPool[e]]
              if (validSet(cands)) return cands
            }
          }
        }
      }
    }

    throw new Error(`LRM-DOTS-AND: no distractor construction cleared the gates for params ${JSON.stringify({ rows: ctx.params.rows })}`)
  },
  nonCardinalAsymmetricRotation: () => false,
  structuralExtra: (params: DotsAndParams) => ({
    rows: params.rows.map((r) => ({ c1: [...r.c1].sort(anchorOrder), c2: [...r.c2].sort(anchorOrder) })),
    fill: params.fill,
  }),
}
