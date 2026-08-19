/**
 * Generation-time degeneracy checks (doc 03-item-generation-pipeline.md
 * §3.5). These run inside `generateFamily` and throw immediately — they are
 * preconditions on a well-formed item, not part of the post-hoc QA report,
 * though `runQaBattery` also re-checks the grid-level ones (G-12) so a
 * report is always available for anything that reaches that stage.
 *
 * Scope note: this module implements the checks doc 03 lists that are
 * reachable by the rule set this generator actually builds (R1/R2/R3/R4/
 * R5/R6/R7 — see rules.ts's header comment). `LADDER_OVERRUN` is enforced
 * structurally rather than as a separate scan: `progressionRule`/
 * `cyclicProgressionRule`'s closed-form `valueAt` cannot silently produce an
 * out-of-range index inside `composeItem` because families source their
 * ladders directly (no external lattice-fill step to overrun); the check
 * below still asserts it explicitly against the realised grid+key, so a
 * future family author who breaks that invariant is caught immediately
 * rather than downstream in the schema parse.
 */
import type { GridCell } from '../../spec/schema'
import { type AxisId, type CellLike, axesPresentIn, axisEq, cellComplexity, cellEq, readAxis } from '../axes'

export interface CheckResult {
  id: string
  status: 'pass' | 'fail' | 'skip'
  detail?: Record<string, unknown>
}

/**
 * `ruleCount`: doc 03-item-generation-pipeline.md §3.5's `CELL_DUPLICATE`
 * ("any two of the 9 cells structurally identical") is mathematically
 * unsatisfiable for a SINGLE-axis rule whose value range is smaller than 9
 * — a pigeonhole result, not a generation defect. Doc 03-logical-reasoning-
 * design.md's own M1 (count 1-5 across 9 cells) and M2 (rotation stepping
 * through only 8 distinct multiples of 45 degrees across 9 cells) exemplars
 * BOTH have a forced duplicate pair for exactly this reason — M1's (1,2)
 * and (2,1) both read "2 circles"; M2's (1,3) and (2,1) both read "arrow
 * 90deg" (verified directly against doc 03-logical-reasoning-design.md §6's
 * own tables). A duplicate wholly predicted by a single declared rule's own
 * arithmetic is not "accidental" the way doc §3.5 means the check — the
 * real risk (an unintended coincidence) needs at least two INDEPENDENTLY
 * governed axes to collide at once, which single-axis items cannot
 * exhibit. So: CELL_DUPLICATE is enforced for `ruleCount >= 2` (a real
 * coincidence across independent axes) and reported as "not applicable" —
 * not silently skipped — for `ruleCount === 1`.
 */
/**
 * `permitKeyEqualsCell`: doc 03-item-generation-pipeline.md's own open
 * question OQ-3 — "recommend permitting full coincidence in a controlled
 * minority of items where the rule set allows it, with a gate requiring
 * >= 2 cell-copying options in those items so the heuristic cannot
 * isolate." `families/lrm-move.ts` is the concrete case that FORCES this:
 * an exhaustive search over every (base, stepCol, stepRow) for a period-3
 * or period-4 cyclic movement axis on a 3x3 grid found ZERO parameter
 * combinations where the key's anchor is not already held by some context
 * cell (documented in that family's header comment) — the key coinciding
 * with a context cell is not a rare accident for this rule type, it is
 * unavoidable. When `permitKeyEqualsCell` is true, KEY_EQUALS_CELL is
 * reported for visibility but does not fail the check; the family calling
 * this with `true` is responsible for satisfying OQ-3's own mitigation
 * (>= 2 options, including the key, that copy a real context cell).
 */
export function gridLevelDegeneracy(grid: readonly GridCell[], keyCell: CellLike, axes: readonly AxisId[], ruleCount: number, permitKeyEqualsCell = false): CheckResult[] {
  const results: CheckResult[] = []
  const all: CellLike[] = [...grid]

  if (ruleCount >= 2) {
    // CELL_DUPLICATE: any two of the 8 context cells visually identical
    // (full cell identity — every axis actually present, not just the rule
    // axes: two cells that agree on the rule-governed axis but differ on an
    // incidental like shape/fill are NOT duplicates).
    let dup: [number, number] | null = null
    for (let i = 0; i < all.length && !dup; i++) {
      for (let j = i + 1; j < all.length; j++) {
        if (cellEq(all[i], all[j])) {
          dup = [i, j]
          break
        }
      }
    }
    results.push(dup ? { id: 'CELL_DUPLICATE', status: 'fail', detail: { pair: dup } } : { id: 'CELL_DUPLICATE', status: 'pass' })
  } else {
    results.push({ id: 'CELL_DUPLICATE', status: 'pass', detail: { note: 'not applicable: single-axis item, see gridLevelDegeneracy doc comment' } })
  }

  // KEY_EQUALS_CELL: key duplicates a context cell exactly (full-cell match, all axes).
  const keyDup = grid.find((c) => cellEq(c, keyCell))
  if (keyDup && permitKeyEqualsCell) {
    results.push({ id: 'KEY_EQUALS_CELL', status: 'pass', detail: { permittedByOQ3: true, at: { row: keyDup.row, col: keyDup.col } } })
  } else {
    results.push(keyDup ? { id: 'KEY_EQUALS_CELL', status: 'fail', detail: { at: { row: keyDup.row, col: keyDup.col } } } : { id: 'KEY_EQUALS_CELL', status: 'pass' })
  }

  // ROW_DUPLICATE: row 3 (context cells only: (3,1),(3,2)) is not diagnostic
  // on its own (row 3 is incomplete pre-solve) — check instead that no two
  // FULL rows among rows 1-2 are permutations of one another as sets, which
  // would license "row 3 must be the missing permutation" without the rules.
  const rows: Record<number, CellLike[]> = { 1: [], 2: [], 3: [] }
  for (const c of grid) rows[c.row].push(c)
  const rowAxes = [...new Set([...axes, ...rows[1].flatMap(axesPresentIn), ...rows[2].flatMap(axesPresentIn)])]
  const asMultiset = (cells: CellLike[]) => cells.map((c) => rowAxes.map((a) => readAxis(c, a)).map((v) => JSON.stringify(v))).sort()
  const row1 = asMultiset(rows[1])
  const row2 = asMultiset(rows[2])
  const rowDup = JSON.stringify(row1) === JSON.stringify(row2)
  results.push(rowDup ? { id: 'ROW_DUPLICATE', status: 'fail' } : { id: 'ROW_DUPLICATE', status: 'pass' })

  // EMPTY_CELL: any cell (context or key) with zero elements. Schema already
  // enforces elements.min(1), so this is a belt-and-braces re-check.
  const empty = [...grid, keyCell].some((c) => c.elements.length === 0)
  results.push(empty ? { id: 'EMPTY_CELL', status: 'fail' } : { id: 'EMPTY_CELL', status: 'pass' })

  return results
}

/** OPERATOR_IDENTITY: result equals an operand in >= 2 of 3 rows — the set operator isn't doing visible work. */
export function operatorIdentityCheck(rows: readonly { a: readonly string[]; b: readonly string[]; result: readonly string[] }[]): CheckResult {
  const sameAsOperand = (r: (typeof rows)[number]) => {
    const eq = (x: readonly string[], y: readonly string[]) => x.length === y.length && [...x].sort().every((v, i) => v === [...y].sort()[i])
    return eq(r.result, r.a) || eq(r.result, r.b)
  }
  const count = rows.filter(sameAsOperand).length
  return count >= 2 ? { id: 'OPERATOR_IDENTITY', status: 'fail', detail: { count } } : { id: 'OPERATOR_IDENTITY', status: 'pass' }
}

export function operandEmptyCheck(rows: readonly { a: readonly string[]; b: readonly string[] }[]): CheckResult {
  const bad = rows.some((r) => r.a.length === 0 || r.b.length === 0)
  return bad ? { id: 'OPERAND_EMPTY', status: 'fail' } : { id: 'OPERAND_EMPTY', status: 'pass' }
}

export function subsetViolationCheck(rows: readonly { a: readonly string[]; b: readonly string[] }[]): CheckResult {
  const bad = rows.some((r) => !r.b.every((x) => r.a.includes(x)))
  return bad ? { id: 'SUBSET_VIOLATION', status: 'fail' } : { id: 'SUBSET_VIOLATION', status: 'pass' }
}

export function symdiffEmptyCheck(rows: readonly { a: readonly string[]; b: readonly string[] }[]): CheckResult {
  const bad = rows.some((r) => {
    const A = new Set(r.a)
    const B = new Set(r.b)
    const sym = [...r.a.filter((x) => !B.has(x)), ...r.b.filter((x) => !A.has(x))]
    return sym.length === 0
  })
  return bad ? { id: 'SYMDIFF_EMPTY', status: 'fail' } : { id: 'SYMDIFF_EMPTY', status: 'pass' }
}

export function stepZeroCheck(stepCol: number, stepRow: number): CheckResult {
  return stepCol === 0 && stepRow === 0 ? { id: 'STEP_ZERO', status: 'fail' } : { id: 'STEP_ZERO', status: 'pass' }
}

export function latinTrivialCheck(rows: readonly (readonly string[])[]): CheckResult {
  const trivial = rows.length === 3 && rows[0].join(',') === rows[1].join(',') && rows[1].join(',') === rows[2].join(',')
  return trivial ? { id: 'LATIN_TRIVIAL', status: 'fail' } : { id: 'LATIN_TRIVIAL', status: 'pass' }
}

/** Rotational-symmetry-order per shape, per doc 03-item-generation-pipeline.md §3.5's ROTATION_ALIAS/SYMMETRY_INVISIBLE. 0 = infinite (circle: any rotation is invisible). */
const SHAPE_SYMMETRY_ORDER: Record<string, number> = { circle: 0, square: 4, diamond: 4, triangle: 3, pentagon: 5, arrow: 1, hexagon: 6, star: 5, cross: 4, semicircle: 1, flag: 1, lshape: 1, trapezoid: 1 }

export function symmetryInvisibleCheck(shape: string, stepDeg: number): CheckResult {
  const order = SHAPE_SYMMETRY_ORDER[shape] ?? 1
  if (order === 0) return { id: 'SYMMETRY_INVISIBLE', status: 'fail', detail: { shape, reason: 'circle has infinite rotational symmetry' } }
  const invisible = stepDeg !== 0 && ((stepDeg % (360 / order)) + (360 / order)) % (360 / order) === 0
  return invisible ? { id: 'SYMMETRY_INVISIBLE', status: 'fail', detail: { shape, stepDeg, order } } : { id: 'SYMMETRY_INVISIBLE', status: 'pass' }
}

/**
 * FINDING (surfaced by issue #344's fix): for a family whose governed axis
 * IS a count (`cellComplexity` reads a repeat element's `count` directly,
 * doc 03-item-generation-pipeline.md §3.5), the wrong-rule mechanism doc
 * 03-logical-reasoning-design.md §6 M1 itself specifies — "assumes the step
 * size itself grows" — necessarily lands 2 past the key in the direction of
 * travel (key=5, WR=6) while the repetition/stall distractors sit at the
 * bottom of the row's range (3, 4). That is doc's OWN four values (3, 4, 5,
 * 6), and their spread is 3, one past this gate's general threshold of 2.
 * This is the SAME shape of finding `qa/density.ts`'s `inkCoverageGate`
 * already documents for `INK_VARIANCE`: a spread that IS the rule's own
 * signal, on a count-governed axis, is not noise to suppress — an item
 * whose whole point is "count changes by an accelerating amount" cannot
 * have all its options within 2 elements of each other without either
 * dropping the wrong-rule distractor (issue #344's original defect) or
 * capping the progression's own range, which would change the item's
 * documented difficulty anchor. `varianceIsRuleIntended` therefore widens
 * the threshold to 3 for count-governed items only — general non-count
 * items keep the doc-specified cap of 2 unchanged.
 */
export function optionComplexitySpreadCheck(options: readonly CellLike[], varianceIsRuleIntended = false): CheckResult {
  const counts = options.map(cellComplexity)
  const spread = Math.max(...counts) - Math.min(...counts)
  const threshold = varianceIsRuleIntended ? 3 : 2
  return spread > threshold ? { id: 'OPTION_COMPLEXITY_SPREAD', status: 'fail', detail: { counts, spread, threshold } } : { id: 'OPTION_COMPLEXITY_SPREAD', status: 'pass' }
}

/**
 * G-11 — copy-elimination resistance. THE invariant: a candidate who applies
 * the purely perceptual heuristic "eliminate every option that reproduces a
 * cell I can already see" must never be left holding the key alone.
 *
 * The option set is partitioned into two classes by that heuristic — the
 * options that ARE verbatim copies of a context cell, and the options that
 * are not. The heuristic hands the candidate one of those two classes
 * (whichever it does not eliminate). So the invariant is simply: **the class
 * containing the key must have at least two members**, leaving a genuine
 * choice either way round.
 *
 * That single rule covers both directions of the failure, which used to be
 * (mis)handled as two unrelated branches in `qa/index.ts`:
 *
 *  - The key is NOT a copy (the normal case, enforced by `KEY_EQUALS_CELL`).
 *    Then "eliminate every copy" must leave >= 2 options — i.e. at least one
 *    distractor must be a genuinely novel figure, not a lifted cell.
 *  - The key IS a copy (doc 03-item-generation-pipeline.md's OQ-3, permitted
 *    for `families/lrm-move.ts` where a 3- or 4-position movement cycle makes
 *    coincidence unavoidable). Then the MIRROR heuristic — "the answer is the
 *    one that repeats a cell" — must not isolate it either, so >= 2 options
 *    must be copies. This is exactly OQ-3's own stated mitigation, so the
 *    `permitKeyEqualsCell` flag no longer needs to be consulted here: the
 *    same expression yields the same requirement for those items. The flag
 *    still governs `KEY_EQUALS_CELL` above, which is a different question.
 *
 * Note what this is NOT: it is not the doc's *other* G-11 wording ("in >= 60%
 * of a batch the key shares a complete layer with a context cell"). That is a
 * batch-level DESCRIPTIVE measure of how cell-like the key looks, and it was
 * the only thing the previous implementation computed for non-OQ-3 families —
 * computed, reported, and then discarded without ever being thresholded. It
 * is still reported (see `qa/index.ts`) as a measurement; the gate is this.
 */
export function copyEliminationCheck(grid: readonly CellLike[], options: readonly CellLike[], keyIndex: number): CheckResult {
  const isCopy = options.map((o) => grid.some((c) => cellEq(c, o)))
  const keyIsCopy = isCopy[keyIndex]
  const copiesCount = isCopy.filter(Boolean).length
  const survivorsAfterElimination = isCopy.filter((f) => f === keyIsCopy).length
  const detail = { copiesCount, keyIsCopy, survivorsAfterElimination, copyFlags: isCopy }
  return survivorsAfterElimination >= 2
    ? { id: 'COPY_ELIMINATION', status: 'pass', detail }
    : { id: 'COPY_ELIMINATION', status: 'fail', detail: { ...detail, reason: 'COPY_ELIMINATION_ISOLATES_KEY' } }
}

/** Boolean form of `copyEliminationCheck`, for families to consult while they are still CHOOSING distractors (so the gate is satisfiable by construction, not just measured after the fact). */
export function copyEliminationOk(grid: readonly CellLike[], options: readonly CellLike[], keyIndex: number): boolean {
  return copyEliminationCheck(grid, options, keyIndex).status === 'pass'
}

// ---------------------------------------------------------------------------
// G-20 — cheap-elimination resistance (2026-08-19, build-plan §2).
// ---------------------------------------------------------------------------

/**
 * G-20 — cheap-elimination resistance (an ADDITION, 2026-08-19; build-plan
 * §2, redesign spec §"The redesign"). Applies when a family declares a
 * cheap/hard split of its rule axes. Verifies that a solver who applies ONLY
 * the cheap rules — and then eliminates — is left with a real choice.
 *
 * FINDING that made it a gate (the first pilot sitting, benchmark doc §3.2):
 * the four 3-rule items on the form — the two highest predicted-b values it
 * carried — were answered correctly in 3.5–12 s each. That is not the pace of
 * inducing three rules; it is the pace of reading two Latin squares off the
 * grid, matching shape+fill against five options, and finding one left. The
 * old G-08 (`KEY_VALUE_DOMINATES`) had FORCED that: it required the key to be
 * a per-axis minority on half the axes, and families satisfied it on the axes
 * cheapest to vary — the cheap ones — so cheap elimination left 1–2 options.
 * The defence against the context-BLIND attack built the context-AWARE one.
 *
 * The invariant this gate states: no strategy cheaper than solving the hard
 * rule may beat chance among fewer than N−1 options. Concretely:
 *   1. on EVERY declared cheap axis, ≥ N−1 options carry the key's value
 *      (4 of 5): the cheap rule's answer is given away, deliberately — it was
 *      never what the item measured (Embretson 1998: radicals drive
 *      difficulty; surface variation is incidental) — and its filter removes
 *      at most one option;
 *   2. the INTERSECTION of all cheap-axis filters still holds ≥ N−1 options.
 *
 * Fails `CHEAP_AXIS_ISOLATES` / `CHEAP_INTERSECTION_ISOLATES`. Skips
 * `NO_CHEAP_AXES` when the family declares none (single-rule families; the
 * bit-grid families, whose rules are comparably hard and HeiQ-balanced), and
 * `ALL_AXES_CHEAP` when every declared axis is cheap (LRM-3R-DIST): there is
 * then no hard rule for the invariant to protect, the family carries the
 * balanced fractional design instead, and G-18 applies to all its axes.
 */
export function cheapEliminationCheck(options: readonly CellLike[], keyIndex: number, cheapAxes: readonly AxisId[] | undefined, axes?: readonly AxisId[]): CheckResult {
  if (!cheapAxes || cheapAxes.length === 0) {
    return { id: 'CHEAP_ELIMINATION', status: 'skip', detail: { reason: 'NO_CHEAP_AXES' } }
  }
  if (axes && axes.length > 0 && axes.every((a) => cheapAxes.includes(a))) {
    return { id: 'CHEAP_ELIMINATION', status: 'skip', detail: { reason: 'ALL_AXES_CHEAP', axes } }
  }

  const N = options.length
  const threshold = N - 1

  // Per-axis check: each cheap axis must have >= N-1 options with the key's value.
  for (const axis of cheapAxes) {
    const keyValue = readAxis(options[keyIndex], axis)
    if (!keyValue) continue
    const survivors = options.filter((o) => {
      const v = readAxis(o, axis)
      return v !== null && axisEq(v, keyValue)
    }).length
    if (survivors < threshold) {
      return { id: 'CHEAP_ELIMINATION', status: 'fail', detail: { reason: 'CHEAP_AXIS_ISOLATES', axis, survivors, threshold } }
    }
  }

  // Intersection check: all cheap axes together must leave >= N-1 options.
  let intersection = Array.from({ length: N }, (_, i) => i)
  for (const axis of cheapAxes) {
    const keyValue = readAxis(options[keyIndex], axis)
    if (!keyValue) continue
    intersection = intersection.filter((i) => {
      const v = readAxis(options[i], axis)
      return v !== null && axisEq(v, keyValue)
    })
  }
  if (intersection.length < threshold) {
    return { id: 'CHEAP_ELIMINATION', status: 'fail', detail: { reason: 'CHEAP_INTERSECTION_ISOLATES', survivors: intersection.length, threshold } }
  }

  return { id: 'CHEAP_ELIMINATION', status: 'pass' }
}

/** Boolean form of `cheapEliminationCheck`, for families choosing distractors. */
export function cheapEliminationOk(options: readonly CellLike[], keyIndex: number, cheapAxes: readonly AxisId[] | undefined, axes?: readonly AxisId[]): boolean {
  return cheapEliminationCheck(options, keyIndex, cheapAxes, axes).status === 'pass'
}

// ---------------------------------------------------------------------------
// G-19 — elimination resistance. See `eliminationResistanceCheck`.
// ---------------------------------------------------------------------------

/**
 * The "how many of X can I count here" reading of a cell: quantities a
 * candidate can read off the figure with no rule knowledge at all. A feature
 * that IS a declared rule axis's own value is excluded — reading it is
 * solving the item, not shortcutting it. A CARDINALITY is never excluded on
 * those grounds even when its axis is declared: `inner.bars` declares the
 * SET, and "count the bars" is a strictly weaker reading that discards the
 * identities the rule is about.
 */
export function surfaceCensus(cell: CellLike, declaredAxes: readonly AxisId[]): Record<string, number> {
  const declared = new Set(declaredAxes)
  const out: Record<string, number> = { elements: cell.elements.length }
  for (const el of cell.elements) {
    out[`type:${el.type}`] = (out[`type:${el.type}`] ?? 0) + 1
    switch (el.type) {
      case 'bars':
        out[`bars:${el.layer}`] = el.bars.length
        break
      case 'dots':
        out[`dots:${el.layer}`] = el.anchors.length
        break
      case 'bitgrid':
        out[`bitgrid:${el.layer}:black`] = el.black.length
        out[`bitgrid:${el.layer}:hatched`] = el.hatched.length
        break
      case 'strokes':
        out[`strokes:${el.layer}`] = el.strokes.length
        break
      case 'nest':
        out[`nest:${el.layer}`] = el.rings.length
        break
      case 'repeat':
        if (!declared.has(`${el.layer}.count`)) out[`repeat:${el.layer}`] = el.count
        break
      case 'tick':
        if (!declared.has(`${el.layer}.length`)) out[`length:${el.layer}`] = el.length
        break
    }
  }
  return out
}

/**
 * The "have I seen this ink anywhere on the grid" reading of a cell — every
 * categorical value it draws. Same exclusion rule as `surfaceCensus`: a value
 * that IS a declared rule axis's value is the rule, not a cue. Individual
 * members of a set-valued axis (`bars`, `anchors`) ARE cues, for the same
 * reason cardinalities are: "that bar appears nowhere" is weaker than the set
 * relation the rule asserts.
 */
export function surfacePalette(cell: CellLike, declaredAxes: readonly AxisId[]): string[] {
  const declared = new Set(declaredAxes)
  const out: string[] = []
  const push = (layer: string, attr: string, value: string | number) => {
    if (!declared.has(`${layer}.${attr}`)) out.push(`${layer}.${attr}=${value}`)
  }
  for (const el of cell.elements) {
    switch (el.type) {
      case 'shape':
        push(el.layer, 'shape', el.shape)
        push(el.layer, 'fill', el.fill)
        push(el.layer, 'size', el.size)
        push(el.layer, 'anchor', el.anchor)
        push(el.layer, 'rotation', el.rotation)
        push(el.layer, 'flip', el.flip ?? 'none')
        break
      case 'repeat':
        push(el.layer, 'shape', el.shape)
        push(el.layer, 'fill', el.fill)
        push(el.layer, 'size', el.size)
        push(el.layer, 'rotation', el.rotation)
        break
      case 'tick':
        push(el.layer, 'rotation', el.rotation)
        break
      case 'bars':
        for (const b of el.bars) out.push(`${el.layer}.bar~${b}`)
        break
      case 'dots':
        for (const a of el.anchors) out.push(`${el.layer}.dot~${a}`)
        push(el.layer, 'fill', el.fill)
        push(el.layer, 'size', el.size)
        break
      case 'bitgrid':
        for (const b of el.black) out.push(`${el.layer}.bitgrid~black~${b}`)
        for (const h of el.hatched) out.push(`${el.layer}.bitgrid~hatched~${h}`)
        break
      case 'strokes':
        for (const k of el.strokes) out.push(`${el.layer}.stroke~${k}`)
        break
      case 'nest':
        for (const r of el.rings) out.push(`${el.layer}.ring~${r}`)
        break
    }
  }
  return out
}

/**
 * "Is this option, as far as the DECLARED RULE AXES are concerned, a cell I
 * can already see?" — the honest reading of "copy". `cellEq` compares every
 * axis present, so an option that reproduces a visible cell and changes only
 * its fill (or size, or anchor — anything no rule governs) counts as a novel
 * figure to `copyEliminationCheck` while a candidate can still eliminate it
 * on sight, from the palette rather than from the rules.
 */
export function ruleAxisTwinOf(grid: readonly CellLike[], option: CellLike, declaredAxes: readonly AxisId[]): number {
  if (declaredAxes.length === 0) return -1
  return grid.findIndex((c) =>
    declaredAxes.every((axis) => {
      const a = readAxis(c, axis)
      const b = readAxis(option, axis)
      if (a === null || b === null) return a === b
      return axisEq(a, b)
    }),
  )
}

export interface EliminationCueFlags {
  /** The option agrees with some visible cell on every declared rule axis. */
  ruleAxisTwin: boolean
  /** The option shows a count, or a piece of ink, that no visible cell shows. */
  outOfVocabulary: boolean
}

/** The two rule-blind cues, evaluated for one option against the visible grid. */
export function eliminationCues(grid: readonly CellLike[], option: CellLike, declaredAxes: readonly AxisId[]): EliminationCueFlags {
  const census: Record<string, Set<number>> = {}
  for (const c of grid) {
    for (const [k, v] of Object.entries(surfaceCensus(c, declaredAxes))) (census[k] ??= new Set()).add(v)
  }
  const palette = new Set<string>()
  for (const c of grid) for (const p of surfacePalette(c, declaredAxes)) palette.add(p)

  const censusMiss = Object.entries(surfaceCensus(option, declaredAxes)).some(([k, v]) => !census[k]?.has(v))
  const paletteMiss = surfacePalette(option, declaredAxes).some((p) => !palette.has(p))
  return { ruleAxisTwin: ruleAxisTwinOf(grid, option, declaredAxes) >= 0, outOfVocabulary: censusMiss || paletteMiss }
}

/**
 * G-19 — elimination resistance (an ADDITION to doc 03-item-generation-
 * pipeline.md §7's G-01..G-17, and the strengthening of G-11 the
 * copy-elimination audit asked for).
 *
 * G-11 partitions the options by ONE rule-blind cue — "is this a verbatim
 * copy of a visible cell?" — and requires the key's class to hold at least
 * two options. Measured over 20 seeds x 8 draws after G-11 was made real,
 * two families passed it and were still solvable with certainty by a
 * candidate who chained a SECOND rule-blind cue behind the first:
 *
 *     LRM-XOR-DIST-XLAYER   129/129   LRM-XOR-XLAYER   121/121
 *
 * because the only non-copy those families could construct carried a bar
 * count (1 or 3) that appeared in no visible cell — every grid cell showed
 * exactly two bars. Eliminating copies left two options; eliminating the
 * impossible-looking one left the key. G-11 was satisfied and the item was
 * still free.
 *
 * The generalisation is that ONE cue is not the unit of the invariant. A
 * candidate applies every cue available, and the item is only honest if the
 * INTERSECTION of the surviving classes still leaves a real choice. This
 * gate therefore partitions the options by the conjunction of the two
 * rule-blind cues a figural matrix affords (`eliminationCues`) and applies
 * G-11's own requirement to that finer partition: **the class the key falls
 * into must hold at least two options.**
 *
 * The two cues, and why each is the honest form of the question:
 *
 *  - `ruleAxisTwin` — "does this option reproduce a cell I can see?", read
 *    on the DECLARED RULE AXES rather than on full cell identity. This is
 *    the correction the audit named: `cellEq` compares every axis present,
 *    so a distractor that copies a visible cell and changes only its fill is
 *    a "novel figure" to G-11 while remaining eliminable on sight. Without
 *    it, any family can clear a raised copy-elimination threshold by
 *    trading copy-elimination for palette-elimination. (G-08 and G-10 read
 *    only declared axes and so cannot see the difference at all.)
 *  - `outOfVocabulary` — "does this option show a count, or a piece of ink,
 *    that appears nowhere on the grid?". This is the cue the two XOR
 *    families were leaking through. Features that ARE a declared axis's own
 *    value are excluded from the vocabulary (see `surfaceCensus`), because
 *    for those the cue and the rule are the same act: LRM-PROG-COUNT's key
 *    shows an element count no cell shows, and that is the item, not a
 *    shortcut.
 *
 * What this gate does NOT license: importing an out-of-vocabulary distractor
 * to satisfy it. Doing so moves the option into the key's class only if the
 * KEY is also out of vocabulary; otherwise it makes the leak worse, exactly
 * as `families/lrm-dist3x2.ts`'s header proves. The satisfying move is to
 * give the item a value space the 9 grid positions cannot exhaust, so that
 * genuine in-vocabulary non-twins exist.
 */
export function eliminationResistanceCheck(grid: readonly CellLike[], options: readonly CellLike[], keyIndex: number, declaredAxes: readonly AxisId[]): CheckResult {
  const flags = options.map((o) => eliminationCues(grid, o, declaredAxes))
  const classOf = (f: EliminationCueFlags) => `${f.ruleAxisTwin ? 'twin' : 'novel'}/${f.outOfVocabulary ? 'unseen' : 'invocab'}`
  const keyClass = classOf(flags[keyIndex])
  const survivors = flags.filter((f) => classOf(f) === keyClass).length
  const detail = { keyClass, survivors, classes: flags.map(classOf) }
  return survivors >= 2
    ? { id: 'ELIMINATION_RESISTANCE', status: 'pass', detail }
    : { id: 'ELIMINATION_RESISTANCE', status: 'fail', detail: { ...detail, reason: 'CUE_CHAIN_ISOLATES_KEY' } }
}

/** Boolean form of `eliminationResistanceCheck`, for families choosing distractors. */
export function eliminationResistanceOk(grid: readonly CellLike[], options: readonly CellLike[], keyIndex: number, declaredAxes: readonly AxisId[]): boolean {
  return eliminationResistanceCheck(grid, options, keyIndex, declaredAxes).status === 'pass'
}

/**
 * G-18 — rule-subset sufficiency (an ADDITION to doc 03-item-generation-
 * pipeline.md §7's G-01..G-17, not a reading of one of them).
 *
 * A multi-rule item claims its difficulty from the number of rules a solver
 * must compose. That claim is false if ONE of the declared rules, applied
 * alone, already picks the key out: the other rules then do no discriminating
 * work, and the item's honest rule count is 1 no matter what its radicals say.
 *
 * The check is the direct measurement of that: for each declared rule axis,
 * count the options carrying the key's true value on that axis. Fewer than 2
 * means a solver who cracked only that one rule is done. With cheapAxes
 * declared (2026-08-19, build-plan §1.1), the ≥ 2 requirement applies to the
 * cheap axes only — the hard axis may isolate, and that is the deliberate
 * property of the contract (solving the hard rule solves the item). When no
 * cheap axes are declared, the requirement applies to all axes unchanged.
 *
 * Not applicable to single-rule families (LRM-ROT, LRM-ADD, LRM-SUB,
 * LRM-MOVE, LRM-PROG-COUNT): for those, the one rule isolating the key is
 * the ITEM, not a shortcut — reported as such rather than silently skipped.
 *
 * STRUCTURAL LIMIT, worth stating because it bounds what this gate can ask
 * for: the corresponding check one level up — "no PAIR of rules suffices in a
 * 3-rule item" — is unsatisfiable alongside G-08. It would require a
 * distractor wrong on exactly one axis for each of the three axes; those
 * three distractors plus the key leave the key's own value in the majority on
 * every axis, which is precisely `contextBlindGate`'s MODAL_HIT_RATE failure.
 * With 5 options, a 3-rule item can guarantee that no single rule suffices,
 * and cannot also guarantee that no pair does.
 */
export function singleRuleSufficiencyCheck(options: readonly CellLike[], keyIndex: number, axes: readonly AxisId[], cheapAxes?: readonly AxisId[]): CheckResult {
  if (axes.length < 2) {
    return { id: 'SINGLE_RULE_SUFFICIENCY', status: 'pass', detail: { note: 'not applicable: single-rule item, its one rule is meant to determine the key' } }
  }
  const survivorsByAxis: Record<string, number> = {}
  const isolating: AxisId[] = []
  const axesToCheck = cheapAxes && cheapAxes.length > 0 ? cheapAxes : axes
  const hardAxes = cheapAxes && cheapAxes.length > 0 ? axes.filter((a) => !cheapAxes.includes(a)) : []

  for (const axis of axes) {
    const keyValue = readAxis(options[keyIndex], axis)
    if (!keyValue) continue
    const survivors = options.filter((o) => {
      const v = readAxis(o, axis)
      return v !== null && axisEq(v, keyValue)
    }).length
    survivorsByAxis[axis] = survivors
    if (axesToCheck.includes(axis) && survivors < 2) {
      isolating.push(axis)
    }
  }

  const permittedToIsolate = hardAxes.filter((a) => (survivorsByAxis[a] ?? 0) < 2)
  return isolating.length === 0
    ? { id: 'SINGLE_RULE_SUFFICIENCY', status: 'pass', detail: { survivorsByAxis, ...(permittedToIsolate.length > 0 && { permittedToIsolate }) } }
    : { id: 'SINGLE_RULE_SUFFICIENCY', status: 'fail', detail: { survivorsByAxis, isolating, reason: 'ONE_RULE_ISOLATES_KEY' } }
}

/** Boolean form of `singleRuleSufficiencyCheck`, for families choosing distractors. */
export function singleRuleSufficiencyOk(options: readonly CellLike[], keyIndex: number, axes: readonly AxisId[], cheapAxes?: readonly AxisId[]): boolean {
  return singleRuleSufficiencyCheck(options, keyIndex, axes, cheapAxes).status === 'pass'
}

/**
 * G-09, third component — the key must not be the option a candidate can pick
 * by BULK alone. `optionComplexitySpreadCheck` above caps how far apart the
 * options may sit; this caps who may sit at the end.
 *
 * FINDING that made it a gate rather than a measurement: LRM-ADD, built to
 * doc 03-logical-reasoning-design.md §6 M4's layout, gave every row disjoint
 * operands, so the union was always the full four-bar set and always the
 * single busiest figure on offer. Measured over 20 seeds x 8 draws, the key
 * was the STRICT maximum-ink option in 141 of 141 items — "pick the fullest
 * tile" solved the family outright, with the bar identities the R4 rule is
 * about never consulted. That is the same class of defect as G-11's and
 * G-19's (a cue that reaches the key without the declared rule content), so
 * it is checked the same way rather than left as a note.
 *
 * Sitting at an extremum is only a giveaway when the key sits there ALONE:
 * an option set of {3,3,3,3,2} is fine, {4,3,2,2,2} with the key on 4 is not.
 */
export function keyBulkExtremumCheck(options: readonly CellLike[], keyIndex: number): CheckResult {
  const counts = options.map(cellComplexity)
  const keyCount = counts[keyIndex]
  const sharers = counts.filter((c) => c === keyCount).length
  if (sharers > 1) return { id: 'KEY_BULK_EXTREMUM', status: 'pass', detail: { counts, sharers } }
  const isMax = counts.every((c) => c <= keyCount)
  const isMin = counts.every((c) => c >= keyCount)
  return isMax || isMin
    ? { id: 'KEY_BULK_EXTREMUM', status: 'fail', detail: { counts, keyCount, at: isMax ? 'max' : 'min', reason: 'BULK_ALONE_ISOLATES_KEY' } }
    : { id: 'KEY_BULK_EXTREMUM', status: 'pass', detail: { counts, sharers } }
}

export function optionHomogeneityCheck(options: readonly CellLike[]): CheckResult {
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      if (cellEq(options[i], options[j])) {
        return { id: 'OPTION_HOMOGENEITY', status: 'fail', detail: { pair: [i, j] } }
      }
    }
  }
  return { id: 'OPTION_HOMOGENEITY', status: 'pass' }
}
