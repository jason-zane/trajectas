/**
 * `AxisRule` — a candidate rule that can (a) say whether it explains an
 * observed lattice and (b) say what it implies at a coordinate. Doc
 * 03-item-generation-pipeline.md §3.2. Used two ways in this codebase:
 *
 *  - VERIFICATION (qa/uniqueness.ts): `ruleSpaceFor(axis, domain)` enumerates
 *    every candidate this module knows how to build for that axis's kind,
 *    `explains()` filters to the ones consistent with the 8 observed cells,
 *    and `implies()` reads off what each survivor says belongs at (3,3).
 *    This is a from-scratch re-derivation from the grid — it does not trust
 *    the generator's own rule choice, which is the whole point of Level A.
 *
 *  - GENERATION (compose.ts / families/*): families compute cell content by
 *    closed-form arithmetic (see the note in compose.ts on why — the
 *    doc's own lattice-bootstrapping sketch has a gap for R6 specifically).
 *    They do NOT go through this module. That keeps verification an
 *    independent check rather than the generator grading its own homework.
 */
import { type AxisId, type AxisLattice, type AxisValue, axisEq, axisKey, distinctValueCount, enumVal, numVal, setVal } from './axes'

export type Direction = 'row' | 'column' | 'both' | 'row_operator' | 'column_operator'
export type CandidateRuleId = 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R10' | 'R11' | 'R12' | `PROBE_${string}`

export interface AxisRule {
  readonly id: CandidateRuleId
  readonly axis: AxisId
  readonly direction: Direction
  readonly label: string
  /** True iff every OBSERVED (non-null) cell of `lat` is consistent with this rule. */
  explains(lat: AxisLattice): boolean
  /** Value implied at (row, col), or null if undetermined. */
  implies(lat: AxisLattice, row: number, col: number): AxisValue | null
}

function cellsOf(lat: AxisLattice): { r: number; c: number; v: AxisValue }[] {
  const out: { r: number; c: number; v: AxisValue }[] = []
  for (let r = 1; r <= 3; r++)
    for (let c = 1; c <= 3; c++) {
      const v = lat[r - 1][c - 1]
      if (v) out.push({ r, c, v })
    }
  return out
}

// ---------------------------------------------------------------------------
// R0 — constant
// ---------------------------------------------------------------------------
export function constantRule(axis: AxisId): AxisRule {
  return {
    id: 'R0',
    axis,
    direction: 'both',
    label: `const(${axis})`,
    explains(lat) {
      const cells = cellsOf(lat)
      if (cells.length === 0) return false
      return cells.every((c) => axisEq(c.v, cells[0].v))
    },
    implies(lat) {
      const cells = cellsOf(lat)
      return cells.length > 0 ? cells[0].v : null
    },
  }
}

// ---------------------------------------------------------------------------
// R1 — quantitative / ordered-ladder progression (linear, no wraparound).
// General form: index(row,col) = baseIdx + stepCol*(col-1) + stepRow*(row-1).
// ---------------------------------------------------------------------------
export function progressionRule(axis: AxisId, ladder: readonly AxisValue[], stepCol: number, stepRow: number): AxisRule {
  const idxOf = (v: AxisValue) => ladder.findIndex((x) => axisEq(x, v))
  return {
    id: 'R1',
    axis,
    direction: stepRow === 0 ? 'row' : stepCol === 0 ? 'column' : 'both',
    label: `prog(${axis},+${stepCol}/col,+${stepRow}/row)`,
    explains(lat) {
      const cells = cellsOf(lat)
      if (cells.length === 0) return false
      const anchor = cells[0]
      const anchorIdx = idxOf(anchor.v)
      if (anchorIdx < 0) return false
      for (const cell of cells) {
        const expIdx = anchorIdx + stepCol * (cell.c - anchor.c) + stepRow * (cell.r - anchor.r)
        if (expIdx < 0 || expIdx >= ladder.length) return false
        if (!axisEq(ladder[expIdx], cell.v)) return false
      }
      return true
    },
    implies(lat, row, col) {
      const cells = cellsOf(lat)
      if (cells.length === 0) return null
      const anchor = cells[0]
      const anchorIdx = idxOf(anchor.v)
      if (anchorIdx < 0) return null
      const idx = anchorIdx + stepCol * (col - anchor.c) + stepRow * (row - anchor.r)
      return idx >= 0 && idx < ladder.length ? ladder[idx] : null
    },
  }
}

// ---------------------------------------------------------------------------
// R2 — rotation progression (modular, degrees). Distinct from R1 because it wraps.
// ---------------------------------------------------------------------------
export function rotationRule(axis: AxisId, stepCol: number, stepRow: number): AxisRule {
  const mod360 = (n: number) => ((n % 360) + 360) % 360
  return {
    id: 'R2',
    axis,
    direction: 'both',
    label: `rot(${axis},+${stepCol}/col,+${stepRow}/row)`,
    explains(lat) {
      const cells = cellsOf(lat)
      if (cells.length === 0) return false
      const anchor = cells[0]
      if (anchor.v.t !== 'num') return false
      for (const cell of cells) {
        if (cell.v.t !== 'num') return false
        const exp = mod360(anchor.v.v + stepCol * (cell.c - anchor.c) + stepRow * (cell.r - anchor.r))
        if (exp !== cell.v.v) return false
      }
      return true
    },
    implies(lat, row, col) {
      const cells = cellsOf(lat)
      if (cells.length === 0) return null
      const anchor = cells[0]
      if (anchor.v.t !== 'num') return null
      return numVal(mod360(anchor.v.v + stepCol * (col - anchor.c) + stepRow * (row - anchor.r)))
    },
  }
}

// ---------------------------------------------------------------------------
// R3 — movement: cyclic progression over a discrete, wrapping ladder (e.g.
// an anchor cycle). Reuses rotation's modular arithmetic over indices.
// ---------------------------------------------------------------------------
export function cyclicProgressionRule(axis: AxisId, ladder: readonly AxisValue[], stepCol: number, stepRow: number): AxisRule {
  const idxOf = (v: AxisValue) => ladder.findIndex((x) => axisEq(x, v))
  const L = ladder.length
  const mod = (n: number) => ((n % L) + L) % L
  return {
    id: 'R3',
    axis,
    direction: 'both',
    label: `cyclic(${axis},{${ladder.map(axisKey).join(',')}},+${stepCol}/col,+${stepRow}/row)`,
    explains(lat) {
      const cells = cellsOf(lat)
      if (cells.length === 0) return false
      const anchor = cells[0]
      const anchorIdx = idxOf(anchor.v)
      if (anchorIdx < 0) return false
      for (const cell of cells) {
        const idx = mod(anchorIdx + stepCol * (cell.c - anchor.c) + stepRow * (cell.r - anchor.r))
        if (!axisEq(ladder[idx], cell.v)) return false
      }
      return true
    },
    implies(lat, row, col) {
      const cells = cellsOf(lat)
      if (cells.length === 0) return null
      const anchor = cells[0]
      const anchorIdx = idxOf(anchor.v)
      if (anchorIdx < 0) return null
      const idx = mod(anchorIdx + stepCol * (col - anchor.c) + stepRow * (row - anchor.r))
      return ladder[idx]
    },
  }
}

// ---------------------------------------------------------------------------
// R6 — distribution of three (Latin square). Parameterless: the observations
// determine it (elimination). `values` is the candidate 3-element value set.
// ---------------------------------------------------------------------------
export function latinSquareRule(axis: AxisId, values: readonly AxisValue[]): AxisRule {
  const keys = values.map(axisKey)
  const line = (lat: AxisLattice, kind: 'row' | 'col', i: number) => [0, 1, 2].map((j) => (kind === 'row' ? lat[i][j] : lat[j][i]))
  return {
    id: 'R6',
    axis,
    direction: 'both',
    label: `latin(${axis},{${keys.join(',')}})`,
    explains(lat) {
      for (const kind of ['row', 'col'] as const) {
        for (let i = 0; i < 3; i++) {
          const seen = line(lat, kind, i)
            .filter((v): v is AxisValue => v !== null)
            .map((v) => axisKey(v))
          if (new Set(seen).size !== seen.length) return false
          if (seen.some((k) => !keys.includes(k))) return false
        }
      }
      return true
    },
    implies(lat, row, col) {
      if (lat[row - 1][col - 1]) return lat[row - 1][col - 1]
      const missing = (kind: 'row' | 'col', i: number) => {
        const seen = new Set(
          line(lat, kind, i)
            .filter((v): v is AxisValue => v !== null)
            .map((v) => axisKey(v)),
        )
        const rest = values.filter((v) => !seen.has(axisKey(v)))
        return rest.length === 1 ? rest[0] : null
      }
      const byRow = missing('row', row - 1)
      const byCol = missing('col', col - 1)
      if (byRow && byCol) return axisEq(byRow, byCol) ? byRow : null
      return byRow ?? byCol
    },
  }
}

// ---------------------------------------------------------------------------
// R4 / R5 / R7 — binary set operators applied along rows or columns.
// ---------------------------------------------------------------------------
export type SetOp = 'union' | 'difference' | 'reverseDifference' | 'symdiff' | 'intersection'

export function applySetOp(op: SetOp, a: readonly string[], b: readonly string[]): readonly string[] {
  const A = new Set(a)
  const B = new Set(b)
  switch (op) {
    case 'union':
      return [...new Set([...a, ...b])].sort()
    case 'difference':
      return a.filter((x) => !B.has(x)).sort()
    case 'reverseDifference':
      return b.filter((x) => !A.has(x)).sort()
    case 'symdiff':
      return [...a.filter((x) => !B.has(x)), ...b.filter((x) => !A.has(x))].sort()
    case 'intersection':
      return a.filter((x) => B.has(x)).sort()
  }
}

/** R11 intersection (v3 build plan §2; BOLT's AND) joins the set-operator family. */
const OP_TO_RULE_ID: Record<SetOp, CandidateRuleId> = { union: 'R4', difference: 'R5', reverseDifference: 'R5', symdiff: 'R7', intersection: 'R11' }

export function setOperatorRule(axis: AxisId, op: SetOp, direction: 'row_operator' | 'column_operator'): AxisRule {
  const operandsOf = (lat: AxisLattice, r: number, c: number): [AxisValue | null, AxisValue | null] =>
    direction === 'row_operator' ? [lat[r - 1][0], lat[r - 1][1]] : [lat[0][c - 1], lat[1][c - 1]]
  const isTarget = (r: number, c: number) => (direction === 'row_operator' ? c : r) === 3
  return {
    id: OP_TO_RULE_ID[op],
    axis,
    direction,
    label: `${op}(${axis},${direction})`,
    explains(lat) {
      for (let r = 1; r <= 3; r++)
        for (let c = 1; c <= 3; c++) {
          if (!isTarget(r, c)) continue
          const obs = lat[r - 1][c - 1]
          if (!obs) continue
          const [x, y] = operandsOf(lat, r, c)
          if (!x || !y || x.t !== 'set' || y.t !== 'set' || obs.t !== 'set') return false
          if (!axisEq(setVal(applySetOp(op, x.v, y.v)), obs)) return false
        }
      return true
    },
    implies(lat, row, col) {
      if (!isTarget(row, col)) return null
      const [x, y] = operandsOf(lat, row, col)
      if (!x || !y || x.t !== 'set' || y.t !== 'set') return null
      return setVal(applySetOp(op, x.v, y.v))
    },
  }
}

// ---------------------------------------------------------------------------
// R10 — reflection as an OPERATION (v3 build plan §2). The flip states
// {none,h,v,hv} form the Klein four-group under composition (h∘h = none,
// h∘v = hv, …). Along the operator direction, cell 2 = cell 1 ∘ op1 and
// cell 3 = cell 2 ∘ op2, with the same (op1, op2) in every row (or column);
// the starting state of each row is free. This is what "mirror it left-
// right, then top-bottom" means as a matrix rule, and it is deliberately
// NOT a ladder: a ladder over three fixed states would make column 3 a
// constant (copyable from the rows above), which is the shortcut the
// first pilot taught us to design out.
// ---------------------------------------------------------------------------
export type FlipState = 'none' | 'h' | 'v' | 'hv'
export type FlipOp = 'h' | 'v' | 'hv'
const FLIP_BITS: Record<FlipState, number> = { none: 0, h: 1, v: 2, hv: 3 }
const FLIP_FROM_BITS: FlipState[] = ['none', 'h', 'v', 'hv']
export function composeFlip(a: FlipState, b: FlipState): FlipState {
  return FLIP_FROM_BITS[FLIP_BITS[a] ^ FLIP_BITS[b]]
}

export function reflectionRule(axis: AxisId, op1: FlipOp, op2: FlipOp, direction: 'row' | 'column'): AxisRule {
  const asFlip = (v: AxisValue | null): FlipState | null => (v && v.t === 'enum' && v.v in FLIP_BITS ? (v.v as FlipState) : null)
  // Position along the operator direction (1..3) and the line index.
  const pos = (r: number, c: number) => (direction === 'row' ? c : r)
  const lineOf = (r: number, c: number) => (direction === 'row' ? r : c)
  const at = (lat: AxisLattice, line: number, p: number) => (direction === 'row' ? lat[line - 1][p - 1] : lat[p - 1][line - 1])
  // State at position p given the state at position q in the same line.
  const transport = (state: FlipState, from: number, to: number): FlipState => {
    let s = state
    if (from < to) {
      for (let p = from; p < to; p++) s = composeFlip(s, p === 1 ? op1 : op2)
    } else {
      for (let p = from; p > to; p--) s = composeFlip(s, p === 2 ? op1 : op2) // inverse of a reflection is itself
    }
    return s
  }
  return {
    id: 'R10',
    axis,
    direction,
    label: `reflect(${axis},${direction},${op1}>${op2})`,
    explains(lat) {
      let any = false
      for (let line = 1; line <= 3; line++) {
        const obs = [1, 2, 3].map((p) => ({ p, v: asFlip(at(lat, line, p)) })).filter((x) => x.v !== null) as { p: number; v: FlipState }[]
        if (obs.length === 0) continue
        // Every observed pair in the line must be consistent with transport from the first.
        const base = obs[0]
        for (const o of obs) {
          any = true
          if (transport(base.v, base.p, o.p) !== o.v) return false
        }
      }
      // Reject if any observed cell is not a flip value at all.
      for (const c of cellsOf(lat)) if (asFlip(c.v) === null) return false
      return any
    },
    implies(lat, row, col) {
      const line = lineOf(row, col)
      const p = pos(row, col)
      const obs = [1, 2, 3].map((q) => ({ q, v: asFlip(at(lat, line, q)) })).filter((x) => x.v !== null && x.q !== p) as { q: number; v: FlipState }[]
      if (obs.length === 0) return null
      return enumVal(transport(obs[0].v, obs[0].q, p))
    },
  }
}

// ---------------------------------------------------------------------------
// R12 — count arithmetic (v3 build plan §2): along the operator direction,
// cell 3 = cell 1 + cell 2 (or cell 1 − cell 2) on a numeric axis. Distinct
// from a progression unless cell 1 = step, which the families avoid.
// ---------------------------------------------------------------------------
export type ArithmeticOp = 'sum' | 'difference'

export function arithmeticRule(axis: AxisId, op: ArithmeticOp, direction: 'row_operator' | 'column_operator'): AxisRule {
  const operandsOf = (lat: AxisLattice, r: number, c: number): [AxisValue | null, AxisValue | null] =>
    direction === 'row_operator' ? [lat[r - 1][0], lat[r - 1][1]] : [lat[0][c - 1], lat[1][c - 1]]
  const isTarget = (r: number, c: number) => (direction === 'row_operator' ? c : r) === 3
  const apply = (a: number, b: number) => (op === 'sum' ? a + b : a - b)
  return {
    id: 'R12',
    axis,
    direction,
    label: `${op}(${axis},${direction})`,
    explains(lat) {
      let any = false
      for (let r = 1; r <= 3; r++)
        for (let c = 1; c <= 3; c++) {
          if (!isTarget(r, c)) continue
          const obs = lat[r - 1][c - 1]
          if (!obs) continue
          const [x, y] = operandsOf(lat, r, c)
          if (!x || !y || x.t !== 'num' || y.t !== 'num' || obs.t !== 'num') return false
          if (apply(x.v, y.v) !== obs.v) return false
          any = true
        }
      return any
    },
    implies(lat, row, col) {
      if (!isTarget(row, col)) return null
      const [x, y] = operandsOf(lat, row, col)
      if (!x || !y || x.t !== 'num' || y.t !== 'num') return null
      const v = apply(x.v, y.v)
      // A count below one is not drawable, so no reading is implied.
      return v >= 1 ? numVal(v) : null
    },
  }
}

// ---------------------------------------------------------------------------
// Accidental-regularity probes (doc 03-item-generation-pipeline.md §5.2's
// "alternation / symmetry probes" row). No generator counterpart — they
// exist purely to catch readings a candidate might find that the family
// author didn't intend. Extending this list only ever makes Level A
// stricter.
// ---------------------------------------------------------------------------
function probe(id: string, label: string, explainsFn: (lat: AxisLattice) => boolean, impliesFn: (lat: AxisLattice, row: number, col: number) => AxisValue | null, axis: AxisId): AxisRule {
  return { id: `PROBE_${id}` as CandidateRuleId, axis, direction: 'both', label, explains: explainsFn, implies: impliesFn }
}

/** Row alternation: cell(r,1) == cell(r,3) in every fully-observed row (ABA pattern). */
export function rowAlternationProbe(axis: AxisId): AxisRule {
  return probe(
    'ROW_ALT',
    `rowAlt(${axis})`,
    (lat) => {
      for (let r = 0; r < 3; r++) {
        const a = lat[r][0]
        const b = lat[r][2]
        if (a && b && !axisEq(a, b)) return false
      }
      return cellsOf(lat).length > 0
    },
    (lat, row, col) => (col === 3 ? lat[row - 1][0] : col === 1 ? lat[row - 1][2] : null),
    axis,
  )
}

/** Column constancy: column 3 holds one value across all three rows. */
export function columnConstancyProbe(axis: AxisId): AxisRule {
  return probe(
    'COL_CONST',
    `colConst(${axis})`,
    (lat) => {
      const col3 = [lat[0][2], lat[1][2], lat[2][2]].filter((v): v is AxisValue => v !== null)
      return col3.length > 0 && col3.every((v) => axisEq(v, col3[0]))
    },
    (lat, row, col) => (col === 3 ? (lat[0][2] ?? lat[1][2]) : null),
    axis,
  )
}

/** Main-diagonal constancy: (1,1), (2,2), (3,3) share one value. */
export function mainDiagonalProbe(axis: AxisId): AxisRule {
  return probe(
    'DIAG_MAIN',
    `diagMain(${axis})`,
    (lat) => {
      const diag = [lat[0][0], lat[1][1], lat[2][2]].filter((v): v is AxisValue => v !== null)
      return diag.length > 0 && diag.every((v) => axisEq(v, diag[0]))
    },
    (lat, row, col) => (row === col ? (lat[0][0] ?? lat[1][1]) : null),
    axis,
  )
}

/** 180-degree rotational symmetry about the centre cell: (r,c) == (4-r,4-c). */
export function rotationalSymmetryProbe(axis: AxisId): AxisRule {
  return probe(
    'ROT_SYM_180',
    `rotSym180(${axis})`,
    (lat) => {
      let any = false
      for (let r = 1; r <= 3; r++)
        for (let c = 1; c <= 3; c++) {
          const a = lat[r - 1][c - 1]
          const b = lat[3 - r][3 - c]
          if (a && b) {
            any = true
            if (!axisEq(a, b)) return false
          }
        }
      return any
    },
    (lat, row, col) => lat[3 - row][3 - col],
    axis,
  )
}

/** Reflective symmetry about the vertical centre line: (r,c) == (r,4-c). */
export function verticalReflectionProbe(axis: AxisId): AxisRule {
  return probe(
    'REFLECT_V',
    `reflectV(${axis})`,
    (lat) => {
      let any = false
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++) {
          const a = lat[r][c]
          const b = lat[r][2 - c]
          if (a && b) {
            any = true
            if (!axisEq(a, b)) return false
          }
        }
      return any
    },
    (lat, row, col) => lat[row - 1][2 - (col - 1)],
    axis,
  )
}

export function accidentalRegularityProbes(axis: AxisId): AxisRule[] {
  return [rowAlternationProbe(axis), columnConstancyProbe(axis), mainDiagonalProbe(axis), rotationalSymmetryProbe(axis), verticalReflectionProbe(axis)]
}

// ---------------------------------------------------------------------------
// Domain description + rule-space enumeration for Level A verification.
// ---------------------------------------------------------------------------
export type AxisKind = 'numeric-linear' | 'numeric-angle' | 'ordered-enum' | 'unordered-enum' | 'set' | 'reflection'

export interface AxisDomain {
  kind: AxisKind
  /** Canonical order for progression enumeration on 'ordered-enum' axes. Required for that kind. */
  ladder?: AxisValue[]
}

/** Infer a reasonable default domain purely from an axis's observed AxisValue shape — used when a caller (e.g. a QA test) hasn't declared one. */
export function inferDomain(lat: AxisLattice): AxisDomain {
  const cells = cellsOf(lat)
  const sample = cells[0]?.v
  if (!sample) return { kind: 'unordered-enum' }
  if (sample.t === 'set') return { kind: 'set' }
  if (sample.t === 'num') return { kind: 'numeric-linear' }
  return { kind: 'unordered-enum' }
}

/**
 * The candidate rule space for one axis, given its domain. Must be a
 * superset of what the generator can produce (doc 03-item-generation-pipeline
 * .md §5.2) — every family's own rule constructor above has an enumerated
 * counterpart here at a range of parameters wide enough to include it.
 */
export function ruleSpaceFor(axis: AxisId, domain: AxisDomain, observed: AxisLattice): AxisRule[] {
  const out: AxisRule[] = [constantRule(axis)]

  if (domain.kind === 'numeric-linear') {
    for (let stepCol = -2; stepCol <= 2; stepCol++) {
      for (let stepRow = -2; stepRow <= 2; stepRow++) {
        if (stepCol === 0 && stepRow === 0) continue
        // Ladder is the full integer line within observed range +/- headroom;
        // progressionRule already rejects out-of-range indices via a bound
        // check, so a generous synthetic ladder is safe and simple.
        const ladder = Array.from({ length: 41 }, (_, i) => numVal(i - 20))
        out.push(progressionRule(axis, ladder, stepCol, stepRow))
      }
    }
    // R12 count arithmetic, both operations, both directions (v3). Where a
    // progression and a sum both explain a grid they imply the same (3,3)
    // value (only when base = step and stepRow = 0), so adding these never
    // makes an already-unique progression item ambiguous.
    for (const op of ['sum', 'difference'] as const) {
      out.push(arithmeticRule(axis, op, 'row_operator'))
      out.push(arithmeticRule(axis, op, 'column_operator'))
    }
  }

  if (domain.kind === 'reflection') {
    const ops: FlipOp[] = ['h', 'v', 'hv']
    for (const op1 of ops)
      for (const op2 of ops) {
        out.push(reflectionRule(axis, op1, op2, 'row'))
        out.push(reflectionRule(axis, op1, op2, 'column'))
      }
    // A solver might also read the three flip states as a distribution.
    if (distinctValueCount(observed) === 3) {
      const values = uniqueValues(observed)
      if (values.length === 3) out.push(latinSquareRule(axis, values))
    }
  }

  if (domain.kind === 'numeric-angle') {
    const steps = [-180, -135, -90, -45, 0, 45, 90, 135, 180]
    for (const stepCol of steps) {
      for (const stepRow of steps) {
        if (stepCol === 0 && stepRow === 0) continue
        out.push(rotationRule(axis, stepCol, stepRow))
      }
    }
  }

  if (domain.kind === 'ordered-enum' && domain.ladder) {
    for (let stepCol = -2; stepCol <= 2; stepCol++) {
      for (let stepRow = -2; stepRow <= 2; stepRow++) {
        if (stepCol === 0 && stepRow === 0) continue
        out.push(progressionRule(axis, domain.ladder, stepCol, stepRow))
      }
    }
    // Cyclic (wrapping) variants too — a movement-style rule is a superset
    // hypothesis a solver might reach for even on a nominally-ordered ladder.
    for (let stepCol = -(domain.ladder.length - 1); stepCol <= domain.ladder.length - 1; stepCol++) {
      for (let stepRow = -(domain.ladder.length - 1); stepRow <= domain.ladder.length - 1; stepRow++) {
        if (stepCol === 0 && stepRow === 0) continue
        out.push(cyclicProgressionRule(axis, domain.ladder, stepCol, stepRow))
      }
    }
  }

  if ((domain.kind === 'unordered-enum' || domain.kind === 'ordered-enum') && distinctValueCount(observed) === 3) {
    const values = uniqueValues(observed)
    if (values.length === 3) out.push(latinSquareRule(axis, values))
  }

  if (domain.kind === 'set') {
    const ops: SetOp[] = ['union', 'difference', 'reverseDifference', 'symdiff', 'intersection']
    for (const op of ops) {
      out.push(setOperatorRule(axis, op, 'row_operator'))
      out.push(setOperatorRule(axis, op, 'column_operator'))
    }
  }

  out.push(...accidentalRegularityProbes(axis))
  return out
}

function uniqueValues(lat: AxisLattice): AxisValue[] {
  const seen = new Map<string, AxisValue>()
  for (const { v } of cellsOf(lat)) if (!seen.has(axisKey(v))) seen.set(axisKey(v), v)
  return [...seen.values()]
}

export { enumVal, numVal, setVal }
