/**
 * The axis abstraction. Doc 03-item-generation-pipeline.md §3.1: an item is a
 * set of independent attribute lattices, one per `(layer, attribute)` axis,
 * each governed by at most one rule (doc 03-logical-reasoning-design.md §3
 * composition invariant 2). This file has no dependency on which family is
 * generating or verifying — it is the shared vocabulary both sides use.
 */
import type { Anchor, BarId, Element, Fill, LayerName, ShapeId, SizeToken } from '../spec/schema'

/**
 * `GridCell` and `OptionSpec` (spec/schema.ts) both have the shape `{
 * elements: Element[] }` plus their own extra fields, but schema.ts's
 * `Cell` — the zod object those two `.extend()` — is exported as a value
 * (the zod schema itself) only, with no matching `export type Cell = z.
 * infer<typeof Cell>`. `CellLike` is the type this module (and everything
 * downstream in generator/) actually needs: anything with an `elements`
 * array. `GridCell` and `OptionSpec` both satisfy it structurally.
 */
export type CellLike = { elements: readonly Element[] }

export type AxisId = string // '<layer>.<attribute>' — validated by RuleSpec's regex at spec-parse time.

export type AxisValue =
  | { t: 'enum'; v: string }
  | { t: 'num'; v: number }
  | { t: 'set'; v: readonly string[] }

/** 3x3, row-major (index [row-1][col-1]). Null where unobserved (always (3,3) pre-solve). */
export type AxisLattice = (AxisValue | null)[][]

export function enumVal(v: string): AxisValue {
  return { t: 'enum', v }
}
export function numVal(v: number): AxisValue {
  return { t: 'num', v }
}
export function setVal(v: readonly string[]): AxisValue {
  return { t: 'set', v: canonicalSort(v) }
}

export function canonicalSort(xs: readonly string[]): string[] {
  return [...xs].sort()
}

export function axisEq(a: AxisValue, b: AxisValue): boolean {
  if (a.t !== b.t) return false
  if (a.t === 'set' && b.t === 'set') {
    return a.v.length === b.v.length && a.v.every((x, i) => x === b.v[i])
  }
  return (a as { v: unknown }).v === (b as { v: unknown }).v
}

/** Stable string form — canonical ordering and hashing/dedup keys. */
export function axisKey(a: AxisValue): string {
  return a.t === 'set' ? `set:${a.v.join('|')}` : `${a.t}:${a.v}`
}

export function emptyLattice(): AxisLattice {
  return [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ]
}

export function latticeAt(lat: AxisLattice, row: number, col: number): AxisValue | null {
  return lat[row - 1][col - 1]
}

/** Build a lattice from 8 GridCell-shaped `{row,col}` observations plus an axis reader; (3,3) is left null. */
export function buildLattice(cells: readonly { row: number; col: number }[], read: (row: number, col: number) => AxisValue | null): AxisLattice {
  const lat = emptyLattice()
  for (const c of cells) {
    lat[c.row - 1][c.col - 1] = read(c.row, c.col)
  }
  return lat
}

export function distinctValueCount(lat: AxisLattice): number {
  const seen = new Set<string>()
  for (const row of lat) for (const v of row) if (v) seen.add(axisKey(v))
  return seen.size
}

// ---------------------------------------------------------------------------
// Reading an axis value out of a concrete Cell (GridCell | OptionSpec share
// the `{ elements }` shape). This is the single place that knows how axis
// names map onto element fields, so every other module (compose, distractors,
// uniqueness, contextblind, degeneracy) can work generically over AxisId.
// ---------------------------------------------------------------------------

export type AxisRef = { layer: LayerName; attr: string }

export function parseAxisId(axis: AxisId): AxisRef {
  const [layer, attr] = axis.split('.')
  return { layer: layer as LayerName, attr }
}

export function makeAxisId(layer: LayerName, attr: string): AxisId {
  return `${layer}.${attr}`
}

/**
 * Read the value an axis carries in a cell. Returns null if the cell has no
 * element on that (layer, attribute) — a real degeneracy for a declared rule
 * axis, but a legitimate "not present" for probes run over axes a candidate
 * cell doesn't use (e.g. checking `inner.rotation` against an option that
 * has no inner layer at all).
 */
export function readAxis(cell: CellLike, axis: AxisId): AxisValue | null {
  const { layer, attr } = parseAxisId(axis)
  const el = cell.elements.find((e) => e.layer === layer)
  if (!el) return null
  switch (attr) {
    case 'shape':
      return el.type === 'shape' || el.type === 'repeat' ? enumVal(el.shape) : null
    case 'fill':
      return el.type === 'shape' || el.type === 'repeat' || el.type === 'dots' ? enumVal(el.fill) : null
    case 'size':
      return el.type === 'shape' || el.type === 'repeat' || el.type === 'dots' ? enumVal(el.size) : null
    case 'rotation':
      return el.type === 'shape' || el.type === 'repeat' || el.type === 'tick' ? numVal(el.rotation) : null
    case 'count':
      return el.type === 'repeat' ? numVal(el.count) : null
    case 'length':
      return el.type === 'tick' ? numVal(el.length) : null
    case 'bars':
      return el.type === 'bars' ? setVal(el.bars) : null
    case 'anchors':
      return el.type === 'dots' ? setVal(el.anchors) : null
    case 'anchor':
      return el.type === 'shape' ? enumVal(el.anchor) : null
    case 'black':
      return el.type === 'bitgrid' ? setVal(el.black.map((x) => x.toString())) : null
    case 'hatched':
      return el.type === 'bitgrid' ? setVal(el.hatched.map((x) => x.toString())) : null
    default:
      return null
  }
}

/** Every `(layer, attribute)` axis that has *some* value in this cell. Used for dynamic axis-discovery in QA. */
export function axesPresentIn(cell: CellLike): AxisId[] {
  const out = new Set<AxisId>()
  for (const el of cell.elements) {
    const layer = el.layer
    switch (el.type) {
      case 'shape':
        out.add(makeAxisId(layer, 'shape'))
        out.add(makeAxisId(layer, 'fill'))
        out.add(makeAxisId(layer, 'size'))
        out.add(makeAxisId(layer, 'rotation'))
        out.add(makeAxisId(layer, 'anchor'))
        break
      case 'repeat':
        out.add(makeAxisId(layer, 'shape'))
        out.add(makeAxisId(layer, 'fill'))
        out.add(makeAxisId(layer, 'size'))
        out.add(makeAxisId(layer, 'rotation'))
        out.add(makeAxisId(layer, 'count'))
        break
      case 'tick':
        out.add(makeAxisId(layer, 'rotation'))
        out.add(makeAxisId(layer, 'length'))
        break
      case 'bars':
        out.add(makeAxisId(layer, 'bars'))
        break
      case 'dots':
        out.add(makeAxisId(layer, 'anchors'))
        out.add(makeAxisId(layer, 'fill'))
        out.add(makeAxisId(layer, 'size'))
        break
      case 'bitgrid':
        out.add(makeAxisId(layer, 'black'))
        out.add(makeAxisId(layer, 'hatched'))
        break
    }
  }
  return [...out]
}

/** Element-count "complexity" metric used by G-07/G-09's homogeneity checks (doc 03 §9 rule 3). */
export function cellComplexity(cell: CellLike): number {
  let n = 0
  for (const el of cell.elements) {
    if (el.type === 'repeat') n += el.count
    else if (el.type === 'bars') n += el.bars.length
    else if (el.type === 'dots') n += el.anchors.length
    else if (el.type === 'bitgrid') n += el.black.length + el.hatched.length
    else n += 1
  }
  return n
}

export function cellEq(a: CellLike, b: CellLike): boolean {
  const axes = new Set([...axesPresentIn(a), ...axesPresentIn(b)])
  for (const axis of axes) {
    const va = readAxis(a, axis)
    const vb = readAxis(b, axis)
    if (va === null || vb === null) {
      if (va !== vb) return false
      continue
    }
    if (!axisEq(va, vb)) return false
  }
  // Also require the same element *kinds* (catches e.g. a bars element with
  // an empty-looking axis diff some future attribute type might not read).
  return a.elements.length === b.elements.length
}

export type { ShapeId, Fill, SizeToken, Anchor, BarId, LayerName, Element }
