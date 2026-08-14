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
  status: 'pass' | 'fail'
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
const SHAPE_SYMMETRY_ORDER: Record<string, number> = { circle: 0, square: 4, diamond: 4, triangle: 3, pentagon: 5, arrow: 1 }

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
 * means a solver who cracked only that one rule is done.
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
 * every axis, which is precisely `contextBlindGate`'s MODAL_RECOVERS_KEY /
 * KEY_VALUE_DOMINATES failure. With 5 options, a 3-rule item can guarantee
 * that no single rule suffices, and cannot also guarantee that no pair does.
 */
export function singleRuleSufficiencyCheck(options: readonly CellLike[], keyIndex: number, axes: readonly AxisId[]): CheckResult {
  if (axes.length < 2) {
    return { id: 'SINGLE_RULE_SUFFICIENCY', status: 'pass', detail: { note: 'not applicable: single-rule item, its one rule is meant to determine the key' } }
  }
  const survivorsByAxis: Record<string, number> = {}
  const isolating: AxisId[] = []
  for (const axis of axes) {
    const keyValue = readAxis(options[keyIndex], axis)
    if (!keyValue) continue
    const survivors = options.filter((o) => {
      const v = readAxis(o, axis)
      return v !== null && axisEq(v, keyValue)
    }).length
    survivorsByAxis[axis] = survivors
    if (survivors < 2) isolating.push(axis)
  }
  return isolating.length === 0
    ? { id: 'SINGLE_RULE_SUFFICIENCY', status: 'pass', detail: { survivorsByAxis } }
    : { id: 'SINGLE_RULE_SUFFICIENCY', status: 'fail', detail: { survivorsByAxis, isolating, reason: 'ONE_RULE_ISOLATES_KEY' } }
}

/** Boolean form of `singleRuleSufficiencyCheck`, for families choosing distractors. */
export function singleRuleSufficiencyOk(options: readonly CellLike[], keyIndex: number, axes: readonly AxisId[]): boolean {
  return singleRuleSufficiencyCheck(options, keyIndex, axes).status === 'pass'
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
