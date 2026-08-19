import 'server-only'
import { fmt, polygon, rot, mirror, arcPoints, isConvex, clipLineToPolygon, clipLineToPolygonEvenOdd, clipLineToCircle, segLength, type Pt } from './geometry'
import type { Anchor, BarId, Element, Fill, Flip, RenderDirectives, RingId, ShapeId, SizeToken, StrokeId } from '../spec/schema'

/**
 * Element -> SVG primitives, per doc 03 (item-generation-pipeline) §6.2-6.6.
 * Every function here is pure: same input, same output string, always — the
 * determinism property the renderer exists to guarantee.
 */

/** Anchor points per doc 03-logical-reasoning-design.md §5.1. */
const ANCHOR_XY: Record<Anchor, Pt> = {
  TL: [20, 20],
  TR: [80, 20],
  BL: [20, 80],
  BR: [80, 80],
  CTR: [50, 50],
}

/** Bounding-box width per doc 03-logical-reasoning-design.md §5.1. */
const SIZE_PX: Record<SizeToken, number> = { S: 25, M: 40, L: 60 }

/** Canonical ordering, doc 03 (item-generation-pipeline) §2.1 rule 4. */
const BAR_ORDER: Record<BarId, number> = { H: 0, V: 1, D1: 2, D2: 3 }
const ANCHOR_ORDER: Record<Anchor, number> = { TL: 0, TR: 1, BL: 2, BR: 3, CTR: 4 }

/** Bar endpoints, doc 03 (item-generation-pipeline) §6.2: all length 60 through CTR. */
const BAR_D = 60 / (2 * Math.SQRT2)
const BAR_ENDPOINTS: Record<BarId, [Pt, Pt]> = {
  H: [[20, 50], [80, 50]],
  V: [[50, 20], [50, 80]],
  D1: [[50 - BAR_D, 50 - BAR_D], [50 + BAR_D, 50 + BAR_D]],
  D2: [[50 + BAR_D, 50 - BAR_D], [50 - BAR_D, 50 + BAR_D]],
}

export type ShapeGeom = { kind: 'circle'; cx: number; cy: number; r: number } | { kind: 'polygon'; points: Pt[] }

/** Stroke endpoints for the `strokes` element: straight strokes span 70 units through CTR. */
const STROKE_HALF = 35
const STROKE_D = STROKE_HALF / Math.SQRT2
const STROKE_ENDPOINTS: Record<'H' | 'V' | 'D1' | 'D2', [Pt, Pt]> = {
  H: [[50 - STROKE_HALF, 50], [50 + STROKE_HALF, 50]],
  V: [[50, 50 - STROKE_HALF], [50, 50 + STROKE_HALF]],
  D1: [[50 - STROKE_D, 50 - STROKE_D], [50 + STROKE_D, 50 + STROKE_D]],
  D2: [[50 + STROKE_D, 50 - STROKE_D], [50 - STROKE_D, 50 + STROKE_D]],
}
const STROKE_ORDER: Record<StrokeId, number> = { H: 0, V: 1, D1: 2, D2: 3, ARC_T: 4, ARC_B: 5 }
const ARC_SEGMENTS = 24

/** Ring widths for the `nest` element, largest first; always centred on CTR. */
export const RING_SIZE: Record<RingId, number> = { R1: 64, R2: 44, R3: 24 }
const RING_ORDER: Record<RingId, number> = { R1: 0, R2: 1, R3: 2 }

/** Shaft/head proportions per doc 03 (item-generation-pipeline) §6.2's arrow row. */
function arrowPoints(cx: number, cy: number, size: number, deg: number): Pt[] {
  const shaftHalf = 0.06 * size
  const headHalf = 0.225 * size
  const headLen = 0.35 * size
  const top = cy - size / 2
  const bottom = cy + size / 2
  const headBaseY = top + headLen
  const raw: Pt[] = [
    [cx - shaftHalf, bottom],
    [cx - shaftHalf, headBaseY],
    [cx - headHalf, headBaseY],
    [cx, top],
    [cx + headHalf, headBaseY],
    [cx + shaftHalf, headBaseY],
    [cx + shaftHalf, bottom],
  ]
  return raw.map(([x, y]) => rot(x, y, cx, cy, deg))
}

/** Five-point star, point up, outer-vertex width = size; inner radius 0.4 of outer. */
function starPoints(cx: number, cy: number, size: number): Pt[] {
  const outerR = size / (2 * Math.cos((18 * Math.PI) / 180))
  const innerR = 0.4 * outerR
  const pts: Pt[] = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const a = ((-90 + 36 * i) * Math.PI) / 180
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return pts
}

/** Greek cross (plus sign) spanning `size` both ways, arm thickness 0.3·size. */
function crossPoints(cx: number, cy: number, size: number): Pt[] {
  const h = size / 2
  const t = 0.15 * size
  return [
    [cx - t, cy - h], [cx + t, cy - h], [cx + t, cy - t], [cx + h, cy - t],
    [cx + h, cy + t], [cx + t, cy + t], [cx + t, cy + h], [cx - t, cy + h],
    [cx - t, cy + t], [cx - h, cy + t], [cx - h, cy - t], [cx - t, cy - t],
  ]
}

/** Half-disc, width = size, flat edge at the bottom, centred on its bounding box. */
function semicirclePoints(cx: number, cy: number, size: number): Pt[] {
  const r = size / 2
  const chordY = cy + r / 2
  return arcPoints(cx, chordY, r, 180, 360, 16)
}

/** Flag: a pole down the left (0.12·size wide) with a pennant to the upper right. */
function flagPoints(cx: number, cy: number, size: number): Pt[] {
  const h = size / 2
  const poleR = cx - h + 0.12 * size
  return [
    [cx - h, cy + h], [cx - h, cy - h], [poleR, cy - h], [cx + h, cy - 0.275 * size], [poleR, cy - 0.05 * size], [poleR, cy + h],
  ]
}

/** L-shape: stem down the left (0.32·size wide), foot along the bottom (0.32·size tall). */
function lshapePoints(cx: number, cy: number, size: number): Pt[] {
  const h = size / 2
  const t = 0.32 * size
  return [
    [cx - h, cy - h], [cx - h + t, cy - h], [cx - h + t, cy + h - t], [cx + h, cy + h - t], [cx + h, cy + h], [cx - h, cy + h],
  ]
}

/**
 * Resolve a shape element's geometry. `square` is a diamond rotated a
 * further 45deg (doc 03 (item-generation-pipeline) §6.2's primitives table);
 * `diamond` is the unrotated n=4 polygon. Rotation is applied about the
 * anchor first, then `flip` mirrors the rotated points about the anchor
 * (v3, R10) — emitted as literal coordinates, never a `transform`.
 */
export function shapeGeometry(shape: ShapeId, cx: number, cy: number, size: number, rotationDeg: number, flip: Flip = 'none'): ShapeGeom {
  const finish = (pts: Pt[]): ShapeGeom => ({ kind: 'polygon', points: flip === 'none' ? pts : pts.map(([x, y]) => mirror(x, y, cx, cy, flip)) })
  const rotated = (pts: Pt[]) => (rotationDeg === 0 ? pts : pts.map(([x, y]) => rot(x, y, cx, cy, rotationDeg)))
  switch (shape) {
    case 'circle':
      return { kind: 'circle', cx, cy, r: size / 2 }
    case 'square':
      return finish(polygon(4, cx, cy, size, rotationDeg + 45))
    case 'diamond':
      return finish(polygon(4, cx, cy, size, rotationDeg))
    case 'triangle':
      return finish(polygon(3, cx, cy, size, rotationDeg))
    case 'pentagon':
      return finish(polygon(5, cx, cy, size, rotationDeg))
    case 'hexagon':
      return finish(polygon(6, cx, cy, size, rotationDeg))
    case 'arrow':
      return finish(arrowPoints(cx, cy, size, rotationDeg))
    case 'star':
      return finish(rotated(starPoints(cx, cy, size)))
    case 'cross':
      return finish(rotated(crossPoints(cx, cy, size)))
    case 'semicircle':
      return finish(rotated(semicirclePoints(cx, cy, size)))
    case 'flag':
      return finish(rotated(flagPoints(cx, cy, size)))
    case 'lshape':
      return finish(rotated(lshapePoints(cx, cy, size)))
  }
}

function boundsOf(geom: ShapeGeom): { minX: number; minY: number; maxX: number; maxY: number } {
  if (geom.kind === 'circle') {
    return { minX: geom.cx - geom.r, maxX: geom.cx + geom.r, minY: geom.cy - geom.r, maxY: geom.cy + geom.r }
  }
  const xs = geom.points.map((p) => p[0])
  const ys = geom.points.map((p) => p[1])
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

/**
 * Emit clipped hatch geometry directly (doc 03 (item-generation-pipeline)
 * §6.3) — no `<pattern>`/`<clipPath>`, which would need `id` attributes (a
 * collision hazard when many item SVGs are inlined on one page, and a
 * hash-stability hazard if the id were ever derived from anything
 * positional). 45deg line family x+y=k, stepped by pitch*sqrt(2); segments
 * under 3 units are dropped (the doc's "sliver floor" — stops hairline
 * fragments at shape corners).
 */
export function hatchSegments(geom: ShapeGeom, pitch: number): [Pt, Pt][] {
  const { minX, minY, maxX, maxY } = boundsOf(geom)
  const step = pitch * Math.SQRT2
  const kMin = Math.ceil((minX + minY) / step) * step
  const kMax = maxX + maxY
  const segs: [Pt, Pt][] = []
  // A long segment along direction (1,-1) through (k,0), well beyond any
  // cell's 0..100 canvas, so the clip functions see the full chord.
  const EXT = 1000
  const convex = geom.kind === 'circle' || isConvex(geom.points)
  for (let k = kMin; k <= kMax; k += step) {
    const p0: Pt = [k - EXT, EXT]
    const p1: Pt = [k + EXT, -EXT]
    if (geom.kind === 'circle') {
      const clipped = clipLineToCircle(p0, p1, geom.cx, geom.cy, geom.r)
      if (clipped && segLength(clipped[0], clipped[1]) >= 3) segs.push(clipped)
    } else if (convex) {
      const clipped = clipLineToPolygon(p0, p1, geom.points)
      if (clipped && segLength(clipped[0], clipped[1]) >= 3) segs.push(clipped)
    } else {
      // Non-convex (star, cross, flag, L, arrow): even-odd clipping yields
      // one run per inside stretch of the chord.
      for (const seg of clipLineToPolygonEvenOdd(p0, p1, geom.points)) {
        if (segLength(seg[0], seg[1]) >= 3) segs.push(seg)
      }
    }
  }
  return segs
}

// ---------------------------------------------------------------------------
// Tag builders — fixed attribute order per doc 03 (item-generation-pipeline)
// §6.6: points|cx|cy|r|x1|y1|x2|y2, then fill, then stroke, then
// stroke-width, then stroke-linecap. No id, no <defs>, no <use>, no xlink:,
// no href, no <foreignObject>, no on* attributes, no <script>, no transform.
// ---------------------------------------------------------------------------

function polygonTag(points: readonly Pt[], fill: string, stroke?: string, strokeWidth?: number): string {
  const pts = points.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' ')
  let tag = `<polygon points="${pts}" fill="${fill}"`
  if (stroke) tag += ` stroke="${stroke}" stroke-width="${fmt(strokeWidth ?? 0)}"`
  return `${tag} />`
}

function circleTag(cx: number, cy: number, r: number, fill: string, stroke?: string, strokeWidth?: number): string {
  let tag = `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" fill="${fill}"`
  if (stroke) tag += ` stroke="${stroke}" stroke-width="${fmt(strokeWidth ?? 0)}"`
  return `${tag} />`
}

function lineTag(x1: number, y1: number, x2: number, y2: number, stroke: string, strokeWidth: number): string {
  return `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" stroke="${stroke}" stroke-width="${fmt(strokeWidth)}" stroke-linecap="round" />`
}

/** Open stroked polyline (arcs are emitted as chords — see geometry.ts arcPoints). */
function polylineTag(points: readonly Pt[], stroke: string, strokeWidth: number): string {
  const pts = points.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' ')
  return `<polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="${fmt(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round" />`
}

/**
 * Mid tone for the `grey` fill (v3): a fixed 45%-ink grey, the same in both
 * themes — grey is a FILL STATE like hatched, not a colour channel (doc 03
 * §6.5 still holds: the item survives desaturation because it already is
 * desaturated). Drawn with the ink outline so the boundary stays crisp.
 */
export const GREY_FILL = '#8E9299'

/** Render a filled/outlined/hatched shape into its constituent tags. */
export function renderFilledGeometry(geom: ShapeGeom, fill: Fill, ink: string, strokeWidth: number, hatchPitch: number): string[] {
  const tags: string[] = []
  // 'outline' and 'hatched' draw the boundary stroke-only; 'grey' fills with
  // the mid tone AND strokes the boundary in ink; 'solid' fills with ink.
  const interior = fill === 'solid' ? ink : fill === 'grey' ? GREY_FILL : 'none'
  const stroked = fill !== 'solid'
  if (geom.kind === 'circle') {
    tags.push(stroked ? circleTag(geom.cx, geom.cy, geom.r, interior, ink, strokeWidth) : circleTag(geom.cx, geom.cy, geom.r, ink))
  } else {
    tags.push(stroked ? polygonTag(geom.points, interior, ink, strokeWidth) : polygonTag(geom.points, ink))
  }
  if (fill === 'hatched') {
    const hatchStrokeWidth = hatchPitch * 0.3
    for (const [a, b] of hatchSegments(geom, hatchPitch)) {
      tags.push(lineTag(a[0], a[1], b[0], b[1], ink, hatchStrokeWidth))
    }
  }
  return tags
}

/** Render a single element (already resolved to canvas-unit coordinates). */
export function renderElement(element: Element, render: RenderDirectives, ink: string, outerGeom: ShapeGeom | null): string[] {
  switch (element.type) {
    case 'shape': {
      const [cx, cy] = ANCHOR_XY[element.anchor]
      const geom = shapeGeometry(element.shape, cx, cy, SIZE_PX[element.size], element.rotation, element.flip ?? 'none')
      return renderFilledGeometry(geom, element.fill, ink, render.strokeWidth, render.hatchPitch)
    }
    case 'tick': {
      const rad = (element.rotation * Math.PI) / 180
      const x2 = 50 + element.length * Math.sin(rad)
      const y2 = 50 - element.length * Math.cos(rad)
      return [lineTag(50, 50, x2, y2, ink, render.strokeWidth)]
    }
    case 'bars': {
      const bars = [...element.bars].sort((a, b) => BAR_ORDER[a] - BAR_ORDER[b])
      const tags: string[] = []
      for (const barId of bars) {
        let [p0, p1] = BAR_ENDPOINTS[barId]
        if (element.clipToOuter && outerGeom) {
          const clipped = outerGeom.kind === 'circle' ? clipLineToCircle(p0, p1, outerGeom.cx, outerGeom.cy, outerGeom.r) : clipLineToPolygon(p0, p1, outerGeom.points)
          if (!clipped) continue
          ;[p0, p1] = clipped
        }
        tags.push(lineTag(p0[0], p0[1], p1[0], p1[1], ink, render.strokeWidth))
      }
      return tags
    }
    case 'dots': {
      const anchors = [...element.anchors].sort((a, b) => ANCHOR_ORDER[a] - ANCHOR_ORDER[b])
      const r = SIZE_PX[element.size] / 2
      const tags: string[] = []
      for (const a of anchors) {
        const [cx, cy] = ANCHOR_XY[a]
        tags.push(...renderFilledGeometry({ kind: 'circle', cx, cy, r }, element.fill, ink, render.strokeWidth, render.hatchPitch))
      }
      return tags
    }
    case 'repeat': {
      const size = SIZE_PX[element.size]
      const tags: string[] = []
      for (const [cx, cy] of repeatPositions(element.count, size)) {
        const geom = shapeGeometry(element.shape, cx, cy, size, element.rotation)
        tags.push(...renderFilledGeometry(geom, element.fill, ink, render.strokeWidth, render.hatchPitch))
      }
      return tags
    }
    case 'bitgrid': {
      // 3×3 mini-grid filling most of the cell: 20-unit mini-cells with 2-unit
      // gaps = 64 of the 100-unit canvas, centred (margin 18). Sized so a
      // mini-cell stays well above `minElementUnits` and so black vs hatched
      // vs empty reads at ~140 CSS px per cell (a mini-cell is then ~28 px,
      // with ~5 hatch strokes at pitch 4). Ink: 4 black mini-cells = 16% of
      // the canvas, 5 black + 3 hatched ≈ 24% — inside qa/density.ts's ceiling.
      // Each mini-cell is drawn through `renderFilledGeometry` as a square
      // polygon, so hatching is the same clipped 45° family every hatched
      // shape uses (no <pattern>/<clipPath>, no ids — see hatchSegments).
      const cellSize = 20
      const gap = 2
      const gridSize = 3 * cellSize + 2 * gap // 64 units
      const startX = (100 - gridSize) / 2 // 18 units from left
      const startY = (100 - gridSize) / 2 // 18 units from top
      const blackSet = new Set(element.black)
      const hatchedSet = new Set(element.hatched)
      const tags: string[] = []
      for (let pos = 0; pos < 9; pos++) {
        const row = Math.floor(pos / 3)
        const col = pos % 3
        const x = startX + col * (cellSize + gap)
        const y = startY + row * (cellSize + gap)
        const geom: ShapeGeom = { kind: 'polygon', points: [[x, y], [x + cellSize, y], [x + cellSize, y + cellSize], [x, y + cellSize]] }
        const fill: Fill = blackSet.has(pos) ? 'solid' : hatchedSet.has(pos) ? 'hatched' : 'outline'
        tags.push(...renderFilledGeometry(geom, fill, ink, render.strokeWidth, render.hatchPitch))
      }
      return tags
    }
    case 'strokes': {
      // Large frameless strokes (v3): straight ones 70 units through CTR,
      // arcs the upper/lower half of the 70-unit circle about CTR — so
      // H + ARC_T + ARC_B reads as a circle with its diameter, and any subset
      // is a distinct glyph. Drawn in canonical order so the output is stable.
      const kinds = [...element.strokes].sort((a, b) => STROKE_ORDER[a] - STROKE_ORDER[b])
      const tags: string[] = []
      for (const kind of kinds) {
        if (kind === 'ARC_T') tags.push(polylineTag(arcPoints(50, 50, STROKE_HALF, 180, 360, ARC_SEGMENTS), ink, render.strokeWidth))
        else if (kind === 'ARC_B') tags.push(polylineTag(arcPoints(50, 50, STROKE_HALF, 0, 180, ARC_SEGMENTS), ink, render.strokeWidth))
        else {
          const [p0, p1] = STROKE_ENDPOINTS[kind]
          tags.push(lineTag(p0[0], p0[1], p1[0], p1[1], ink, render.strokeWidth))
        }
      }
      return tags
    }
    case 'nest': {
      // Concentric containers (v3), largest first so inner rings paint on
      // top. Ring k's shape/fill come from the per-item tuples; only the
      // innermost ring may carry a non-outline fill (schema refine), so an
      // outer ring never hides the ones inside it.
      const rings = [...element.rings].sort((a, b) => RING_ORDER[a] - RING_ORDER[b])
      const tags: string[] = []
      for (const ring of rings) {
        const idx = RING_ORDER[ring]
        const geom = shapeGeometry(element.ringShapes[idx], 50, 50, RING_SIZE[ring], 0)
        tags.push(...renderFilledGeometry(geom, element.ringFills[idx], ink, render.strokeWidth, render.hatchPitch))
      }
      return tags
    }
  }
}

/**
 * Layout for repeated elements, doc 03-logical-reasoning-design.md §5.1's
 * count convention: 1-3 in a single centred row with 8-unit gaps; 4 = 2+2;
 * 5 = 3+2; 6 = 3+3 (top row first, both rows centred, subitisable at a
 * glance). The 6 = 3+3 case was added alongside the schema's count cap
 * being raised from 5 to 6 (issue #344) to keep M1's documented "6 circles"
 * wrong-rule distractor representable and legible.
 */
export function repeatPositions(count: number, size: number): Pt[] {
  const gap = 8
  const rowCounts = count <= 3 ? [count] : count === 4 ? [2, 2] : count === 5 ? [3, 2] : [3, 3]
  const rowHeight = size + gap
  const startY = 50 - ((rowCounts.length - 1) * rowHeight) / 2
  const positions: Pt[] = []
  rowCounts.forEach((rowCount, rowIdx) => {
    const rowWidth = rowCount * size + (rowCount - 1) * gap
    const startX = 50 - rowWidth / 2 + size / 2
    const y = startY + rowIdx * rowHeight
    for (let i = 0; i < rowCount; i++) {
      positions.push([startX + i * (size + gap), y])
    }
  })
  return positions
}
