/**
 * The inner-bar construction shared by `lrm-xor-xlayer.ts` (M8) and
 * `lrm-xor-dist-xlayer.ts`. Both families assert R7 — "the third cell in each
 * row holds exactly the bars appearing in exactly one of the first two" — on
 * `inner.bars`, and both used to build it the same way, from a THREE-bar
 * universe: every cell showed all three bars minus one, so the nine cells
 * realised only three distinct bar-sets.
 *
 * WHY THAT WAS REPLACED (the defect this module exists to fix). A cell in
 * either family is (outer shape x inner bar-set). With 3 shapes and 3
 * two-bar sets there are 9 distinguishable cells, and a duplicate-free grid
 * plus the key consumes all 9. So NO in-vocabulary non-copy could exist —
 * exactly the pigeonhole `families/lrm-dist3x2.ts` was unregistered for. The
 * previous fix reached for that file's own explicitly-rejected escape hatch:
 * it added one-bar and three-bar sets to the distractor pool, which no cell
 * can show. Measured over 20 seeds, a candidate who eliminated the verbatim
 * copies and then the option carrying an impossible bar count was left
 * holding the key alone in 129/129 and 121/121 items respectively.
 *
 * The theorem that rules that repair out, stated in its correct and
 * strongest form (`lrm-dist3x2.ts`'s original wording reasoned over 2 axes
 * while `cellEq` compares 5): **when the grid exhausts the vocabulary, every
 * non-key non-copy must carry a feature value that appears in zero visible
 * cells** — so it is eliminable by a cue that costs no rule extraction, and
 * importing one only trades a one-member class for another one-member class.
 *
 * THE FIX IS TO WIDEN THE VOCABULARY, so that in-vocabulary non-copies exist
 * at all: draw the two-bar sets from all FOUR bar positions the schema
 * already defines (`BarId` = H | V | D1 | D2, all four already rendered by
 * `render/primitives.ts`). C(4,2) = 6 two-bar sets x 3 shapes = 18
 * distinguishable cells against 9 grid positions, so nine (shape, bar-set)
 * combinations are always left over — every one of them a genuine
 * two-bar figure drawn from bars the candidate has already seen.
 *
 * ---------------------------------------------------------------------------
 * THE CONSTRUCTION, and its proofs.
 *
 * Index the four bars `roles = [b0, b1, b2, u]` (a permutation of H/V/D1/D2
 * drawn per item). Write R = row-1 and C = col-1 for 0-based coordinates.
 *
 *   1. Row R omits `b_R` entirely. Its three cells are drawn from the
 *      TRIANGLE `T_R = {b0,b1,b2,u} \ {b_R}` (a 3-element set).
 *   2. Within row R, each cell drops one further bar: the one holding "role"
 *      `m = (C - R) mod 3`, where bar `b_j` (j in 0..2) holds role
 *      `(2 - R - j) mod 3` and `u` inherits the role slot vacated by the
 *      row's own omitted bar `b_R`.
 *
 * (R7) HOLDS EXACTLY, EVERY ROW. Across C = 0,1,2 the dropped role
 * `m = (C-R) mod 3` takes all three values, so row R's three cells are the
 * three DISTINCT two-element subsets of the three-element set `T_R`. For any
 * 3-set, the symmetric difference of two distinct 2-subsets is the third
 * (their union is `T_R` and their intersection is the single shared element,
 * which cancels). So `C3 = C1 xor C2` identically, for every parameter draw
 * — no rejection sampling, same as the construction it replaces.
 *
 * (COLUMNS) The same relation holds down each column, as it did before this
 * change: substituting `m = (C-R) mod 3` into the role map gives
 * `j = (2 - R - m) mod 3 = (2 - C) mod 3`, which depends only on C. So
 * column C drops the same indexed bar `b_{(2-C) mod 3}` in every row bar the
 * one row where that bar is the omitted one (there `u` is dropped instead),
 * and the three column cells work out to the three 2-subsets of the triangle
 * `{b0,b1,b2,u} \ {b_{(2-C) mod 3}}` — again XOR-closed. This is a property
 * of the previous construction too, not a regression; Level A sees both
 * readings and they imply the same key, so the item stays uniquely solvable.
 *
 * (NO DUPLICATE CELLS, AND THE KEY IS NEVER A CELL) Two cells can only share
 * a bar-set if they are in different rows (within a row the three sets are
 * distinct, above). Rows R and R' draw from triangles differing in exactly
 * one element, so they share exactly ONE 2-subset, namely
 * `{b0,b1,b2,u} \ {b_R, b_R'}` — giving exactly three collision PAIRS in the
 * whole grid. Working the role map through for each of the three pairs, the
 * colliding cells sit at:
 *
 *       (row 1, col 1) & (row 3, col 3)      (row 1, col 2) & (row 2, col 3)
 *       (row 2, col 1) & (row 3, col 2)
 *
 * Each pair differs in BOTH row and column. That is what makes the
 * construction safe for both consumers without either having to search:
 *   - `lrm-xor-xlayer.ts` gives outer shape a COLUMN-only reading, and every
 *     pair above differs in column, so the two cells differ in shape.
 *   - `lrm-xor-dist-xlayer.ts` gives outer shape a cyclic Latin square with
 *     k = 1, i.e. a function of `(row + col) mod 3`; the pairs above have
 *     `(row+col) mod 3` equal to (2, 0), (0, 2) and (0, 2) respectively, so
 *     again the two cells differ in shape.
 * The key sits at (3,3), whose only bar-twin is (1,1) — a different column
 * AND a different `(row+col) mod 3`, so `KEY_EQUALS_CELL` cannot fire for
 * either family, for any draw.
 *
 * (THE KEY'S BAR-SET IS ITSELF VISIBLE) The role map was chosen so that
 * (3,3)'s bar-set also appears at (1,1) rather than being the one 2-subset
 * the grid never shows. Six of the possible role maps satisfy the collision
 * requirement above; this one additionally denies a candidate the reading
 * "the answer must be the bar pair I have not seen yet".
 * ---------------------------------------------------------------------------
 */
import type { BarId } from '../../spec/schema'

/** `[b0, b1, b2, u]` — a permutation of the four bar positions. Row r omits `roles[r-1]`; `u = roles[3]` is in every row. */
export type BarRoles = [BarId, BarId, BarId, BarId]

export const ALL_BAR_IDS: BarId[] = ['H', 'V', 'D1', 'D2']

const BAR_ORDER: Record<BarId, number> = { H: 0, V: 1, D1: 2, D2: 3 }

/** Canonical draw order for a bars element (matches `spec/canonical.ts`'s read-time sort). */
export function sortBars(bars: readonly BarId[]): BarId[] {
  return [...bars].sort((a, b) => BAR_ORDER[a] - BAR_ORDER[b])
}

const mod3 = (n: number) => ((n % 3) + 3) % 3

/** The bar dropped at (row, col) — `u` whenever the role slot is the one the row's omitted bar vacated. See the header proof. */
function droppedBar(roles: BarRoles, row: number, col: number): BarId {
  const r = row - 1
  const missingRole = mod3(col - row)
  const j = mod3(2 - r - missingRole)
  return roles[j === r ? 3 : j]
}

/** The two bars drawn at (row, col): the four-bar universe minus the row's omitted bar minus the cell's dropped bar. */
export function barsAt(roles: BarRoles, row: number, col: number): BarId[] {
  const omitted = roles[row - 1]
  const dropped = droppedBar(roles, row, col)
  return sortBars(roles.filter((b) => b !== omitted && b !== dropped))
}

/** All six two-bar sets over the four bar positions — the item's own bar vocabulary, and the whole distractor pool on this axis. */
export function twoBarSets(roles: BarRoles): BarId[][] {
  const out: BarId[][] = []
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) out.push(sortBars([roles[i], roles[j]]))
  return out
}

export function sameBars(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x))
}
