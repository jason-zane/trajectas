/**
 * Visual density / legibility gates (doc 03-item-generation-pipeline.md
 * §3.5 "Visual degeneracy" table and §7's G-15 render check).
 *
 * DEVIATION (reported in the LR-7 writeup): doc §6.1 specifies
 * `@resvg/resvg-js` rasterisation for ink coverage and the hatch
 * run-length check. That package is not installed
 * (`node_modules/@resvg` does not exist) and this task's constraints rule
 * out adding a dependency. Ink coverage here is computed ANALYTICALLY from
 * the same geometry the real renderer resolves elements to (`shapeGeometry`,
 * `signedArea` — both imported from `render/`, not reimplemented), rather
 * than rasterised. This is exact for the shapes in this vocabulary (all
 * convex polygons + circles — no antialiasing/sub-pixel effects to
 * approximate), so it is a strictly more precise measurement of the
 * quantity doc §3.5's `INK_COVERAGE`/`INK_VARIANCE` thresholds care about,
 * at the cost of not exercising the actual raster path resvg would. The
 * render-check gate below (`renderLegibilityGate`) compensates by calling
 * the REAL renderer (`renderCellSvg`, `hatchSegments`) and inspecting its
 * actual string/segment output, so the renderer itself IS exercised — see
 * doc §7.3/§10.2 "round-trip through the renderer".
 */
import type { Element, LayerName, RenderDirectives } from '../../spec/schema'
import { shapeGeometry, hatchSegments, RING_SIZE } from '../../render/primitives'
import { signedArea } from '../../render/geometry'
import { renderCellSvg } from '../../render/matrix-svg'
import { type CellLike, cellComplexity } from '../axes'

const ANCHOR_XY: Record<string, [number, number]> = { TL: [20, 20], TR: [80, 20], BL: [20, 80], BR: [80, 80], CTR: [50, 50] }
const SIZE_PX: Record<string, number> = { S: 25, M: 40, L: 60 }
const CANVAS_AREA = 100 * 100

function shapeArea(shape: string, size: number): number {
  if (shape === 'circle') return Math.PI * (size / 2) ** 2
  // Arrow keeps its v1 rough estimate (the coverage band was tuned against
  // it; the exact polygon is ~0.16·size² and would push M arrows under the
  // floor). Every other shape — v1 regular polygons and the v3 additions —
  // uses the exact shoelace area of its render polygon (all are simple).
  if (shape === 'arrow') return size * size * 0.5
  const geom = shapeGeometry(shape as never, 0, 0, size, 0)
  return geom.kind === 'polygon' ? Math.abs(signedArea(geom.points)) : Math.PI * (size / 2) ** 2
}

/** Perimeter-ish ink for an outline ring: ~3.5·width for every admissible ring shape. */
function ringInk(shape: string, width: number, fill: string, strokeWidth: number): number {
  const perimeter = shape === 'circle' ? Math.PI * width : shape === 'hexagon' ? 6 * (width / Math.sqrt(3)) : 4 * (shape === 'diamond' ? width / Math.SQRT2 : width)
  const area = shapeArea(shape, width)
  if (fill === 'solid') return area
  if (fill === 'grey') return 0.45 * area + perimeter * strokeWidth
  if (fill === 'hatched') return 0.3 * area + perimeter * strokeWidth
  return perimeter * strokeWidth
}

/** Analytic ink area for one element, in canvas-unit^2 (before /CANVAS_AREA normalisation). */
export function elementInkArea(el: Element, strokeWidth: number): number {
  switch (el.type) {
    case 'shape':
      return shapeArea(el.shape, SIZE_PX[el.size])
    case 'repeat':
      return el.count * shapeArea(el.shape, SIZE_PX[el.size])
    case 'dots':
      return el.anchors.length * Math.PI * (SIZE_PX[el.size] / 2) ** 2
    case 'tick':
      return el.length * strokeWidth
    case 'bars':
      return el.bars.length * 60 * strokeWidth
    case 'bitgrid':
      // Each mini-cell is 8×8 units; black cells are solid fill, hatched cells are
      // approximately equivalent. Total ink = (black + hatched cell count) × 64.
      return (el.black.length + el.hatched.length) * 64
    case 'strokes':
      // Straight strokes are 70 units; arcs are half the 70-unit circle (≈110).
      return el.strokes.reduce((sum, k) => sum + (k === 'ARC_T' || k === 'ARC_B' ? Math.PI * 35 : 70) * strokeWidth, 0)
    case 'nest':
      return el.rings.reduce((sum, ring) => {
        const idx = ring === 'R1' ? 0 : ring === 'R2' ? 1 : 2
        return sum + ringInk(el.ringShapes[idx], RING_SIZE[ring], el.ringFills[idx], strokeWidth)
      }, 0)
  }
}

export function cellInkFraction(cell: CellLike, strokeWidth: number): number {
  const total = cell.elements.reduce((s, el) => s + elementInkArea(el, strokeWidth), 0)
  return total / CANVAS_AREA
}

/**
 * FINDING: a cell built ENTIRELY from line elements (bars/ticks) cannot
 * clear `INK_MIN` under an area-based coverage measure — a single 60-unit
 * x 2-unit bar covers 1.2% of the canvas, and even doc 03-logical-
 * reasoning-design.md's own M4/M8 bar-set exemplars have 2-bar options at
 * ~2.4%, both well under the 4% floor. That floor's actual purpose — "is
 * this too faint/small to read" — is an AREA proxy that only makes sense
 * for blob-shaped ink (a shape, a cluster of dots). A line's legibility is
 * governed by its LENGTH and stroke width, both of which are already
 * bounded by the schema (bars fixed at 60 units; ticks 10-45) and checked
 * directly by `renderLegibilityGate`'s hatch/stroke assertions — area is
 * simply the wrong proxy for a 1-dimensional mark. This cell-by-cell
 * exemption only lifts the FLOOR; the ceiling (`INK_MAX`, genuine clutter)
 * still applies to every cell regardless of composition.
 */
function isLineOnlyCell(cell: CellLike): boolean {
  return cell.elements.length > 0 && cell.elements.every((el) => el.type === 'bars' || el.type === 'tick' || el.type === 'strokes')
}

export interface DensityGateResult {
  status: 'pass' | 'fail'
  detail?: Record<string, unknown>
}

const INK_MIN = 0.04
const INK_MAX = 0.38
const INK_VARIANCE_MAX = 4.0

/** Bitgrid, nest and stroke cells: set-valued rule axes whose per-cell ink is the rule's own signal (see inkCoverageGate) — one ring vs three, one stroke vs four, is what the item shows, not clutter. A lone 24-unit ring or a single 70-unit stroke is legible by construction (well above minElementUnits), so the area floor does not apply either. */
function isBitgridCell(cell: CellLike): boolean {
  return cell.elements.length > 0 && cell.elements.some((el) => el.type === 'bitgrid' || el.type === 'nest' || el.type === 'strokes')
}

/**
 * `varianceIsRuleIntended`: FINDING, reported in the LR-7 writeup — doc
 * 03-item-generation-pipeline.md §3.5's `INK_VARIANCE` (max/min <= 4.0
 * across the 9 cells) is unsatisfiable, unavoidably, for ANY family whose
 * rule-governed axis is a `count` progression spanning doc 03-logical-
 * reasoning-design.md §5.1's full designed range of 1-5: ink scales
 * linearly with count, so 5 elements vs 1 element is EXACTLY a 5.0 ratio,
 * every time, regardless of which shape or size is chosen — verified
 * directly against doc 03-logical-reasoning-design.md's own M1 exemplar
 * (count 1..5) and the already-landed LR-4 fixture
 * (tests/fixtures/cognitive/m1.ts), which has the identical count range.
 * For a count-progression item this variance is not an accident to catch —
 * it IS the rule signal the item is testing; suppressing the visible
 * quantity difference would make the item worse, not more legible. This
 * gate therefore SKIPS the ratio check (while still enforcing the absolute
 * per-cell floor/ceiling — a single very sparse or very cluttered cell is
 * still a real legibility problem) whenever the caller marks the variance
 * as rule-intended.
 *
 * BITGRID SPECIAL CASE: bitgrid cells carry set-valued rule axes, which
 * naturally vary (the rule produces different set compositions per cell),
 * so bitgrid items are classified as `varianceIsRuleIntended` by default.
 * The INK_MAX ceiling still applies to guard against over-dense grids.
 */
export function inkCoverageGate(cells: readonly CellLike[], strokeWidth: number, varianceIsRuleIntended = false): DensityGateResult {
  const fractions = cells.map((c) => cellInkFraction(c, strokeWidth))
  const isBitgridItem = cells.some(isBitgridCell)
  const outOfBand = cells
    .map((c, i) => ({ c, f: fractions[i] }))
    .filter(({ c, f }) => f > INK_MAX || (f < INK_MIN && !isLineOnlyCell(c) && !isBitgridCell(c)))
  if (outOfBand.length > 0) return { status: 'fail', detail: { reason: 'INK_COVERAGE', fractions } }
  if (varianceIsRuleIntended || isBitgridItem) return { status: 'pass', detail: { fractions, varianceCheckSkipped: varianceIsRuleIntended ? 'rule-intended count variation' : 'bitgrid set-operator variance' } }
  const max = Math.max(...fractions)
  const min = Math.min(...fractions)
  if (min > 0 && max / min > INK_VARIANCE_MAX) return { status: 'fail', detail: { reason: 'INK_VARIANCE', ratio: max / min, fractions } }
  return { status: 'pass', detail: { fractions } }
}

/** ELEMENT_OVERLAP: two elements on the SAME layer whose bounding boxes overlap by > 15% of the smaller box. Cross-layer overlap is licensed by design. */
export function elementOverlapGate(cell: CellLike): DensityGateResult {
  const boxes = cell.elements.map((el) => ({ layer: el.layer, box: boundsOf(el) })).filter((x): x is { layer: LayerName; box: NonNullable<ReturnType<typeof boundsOf>> } => x.box !== null)
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxes[i].layer !== boxes[j].layer) continue
      const overlap = overlapArea(boxes[i].box, boxes[j].box)
      const smaller = Math.min(areaOf(boxes[i].box), areaOf(boxes[j].box))
      if (smaller > 0 && overlap / smaller > 0.15) return { status: 'fail', detail: { reason: 'ELEMENT_OVERLAP', i, j, ratio: overlap / smaller } }
    }
  }
  return { status: 'pass' }
}

function boundsOf(el: Element): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (el.type === 'shape' || el.type === 'repeat') {
    const [cx, cy] = ANCHOR_XY[el.type === 'shape' ? el.anchor : 'CTR']
    const size = SIZE_PX[el.size]
    return { minX: cx - size / 2, maxX: cx + size / 2, minY: cy - size / 2, maxY: cy + size / 2 }
  }
  if (el.type === 'dots') {
    const size = SIZE_PX[el.size]
    const xs = el.anchors.map((a) => ANCHOR_XY[a][0])
    const ys = el.anchors.map((a) => ANCHOR_XY[a][1])
    return { minX: Math.min(...xs) - size / 2, maxX: Math.max(...xs) + size / 2, minY: Math.min(...ys) - size / 2, maxY: Math.max(...ys) + size / 2 }
  }
  if (el.type === 'bitgrid') {
    // Bitgrid occupies a 3×3 grid of 8-unit cells with 1-unit gaps, centered in the 100×100 canvas.
    const cellSize = 8
    const gap = 1
    const gridSize = 3 * cellSize + 2 * gap // 26 units
    const start = (100 - gridSize) / 2 // 37 units
    const end = start + gridSize // 63 units
    return { minX: start, maxX: end, minY: start, maxY: end }
  }
  if (el.type === 'nest') {
    const w = Math.max(...el.rings.map((r) => RING_SIZE[r]))
    return { minX: 50 - w / 2, maxX: 50 + w / 2, minY: 50 - w / 2, maxY: 50 + w / 2 }
  }
  if (el.type === 'strokes') return { minX: 15, maxX: 85, minY: 15, maxY: 85 }
  return null
}
function areaOf(b: { minX: number; minY: number; maxX: number; maxY: number }): number {
  return Math.max(0, b.maxX - b.minX) * Math.max(0, b.maxY - b.minY)
}
function overlapArea(a: { minX: number; minY: number; maxX: number; maxY: number }, b: { minX: number; minY: number; maxX: number; maxY: number }): number {
  const w = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX))
  const h = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY))
  return w * h
}

/** Forbidden output tokens — mirrors tests/unit/cognitive-render-matrix.test.ts's list (doc 03-item-generation-pipeline.md §6.6). */
const FORBIDDEN_TOKEN_PATTERNS: RegExp[] = [/<script/i, /<foreignObject/i, /\bon\w+=/i, /\bhref=/i, /xlink:/i, /\bid="/, /<defs/i, /<use\b/i, /<text/i, /font-/i, /\btransform=/i]

/**
 * G-15 (per-item render check), run against the REAL renderer: every
 * element's size floor, stroke width, and hatch run-length come from
 * `render/primitives.ts`'s own `hatchSegments`/`renderElement`, and the
 * emitted SVG string is scanned for forbidden tokens exactly as the LR-4
 * render test does. This is the round-trip-through-the-renderer proof for
 * generated items, not just the eight hand-written exemplar fixtures.
 */
export function renderLegibilityGate(cell: CellLike, render: RenderDirectives): DensityGateResult {
  const svg = renderCellSvg(cell.elements, { canvas: render.canvas, strokeWidth: render.strokeWidth, hatchPitch: render.hatchPitch, minElementUnits: render.minElementUnits, styleVersion: render.styleVersion })
  for (const pattern of FORBIDDEN_TOKEN_PATTERNS) {
    if (pattern.test(svg)) return { status: 'fail', detail: { reason: 'FORBIDDEN_TOKEN', pattern: pattern.source } }
  }
  // Every numeric attribute literal must be finite (doc §6.6's second golden test).
  const nums = [...svg.matchAll(/="(-?[0-9][0-9.,\s-]*)"/g)].flatMap((m) => m[1].split(/[,\s]+/)).filter((t) => t !== '').map(Number)
  if (nums.some((n) => !Number.isFinite(n))) return { status: 'fail', detail: { reason: 'NON_FINITE_NUMBER' } }

  for (const el of cell.elements) {
    if (el.type === 'shape' && el.fill === 'hatched') {
      const geom = shapeGeometry(el.shape, 50, 50, SIZE_PX[el.size], el.rotation, el.flip ?? 'none')
      const segs = hatchSegments(geom, render.hatchPitch)
      const tooShort = segs.some(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]) < 2)
      if (tooShort) return { status: 'fail', detail: { reason: 'HATCH_RUN_TOO_SHORT' } }
    }
  }
  return { status: 'pass' }
}

export function optionComplexitySpread(options: readonly CellLike[]): number {
  const counts = options.map(cellComplexity)
  return Math.max(...counts) - Math.min(...counts)
}
