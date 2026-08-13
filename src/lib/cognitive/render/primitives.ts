import 'server-only'
import { fmt, polygon, rot, clipLineToPolygon, clipLineToCircle, segLength, type Pt } from './geometry'
import type { Anchor, BarId, Element, Fill, RenderDirectives, ShapeId, SizeToken } from '../spec/schema'

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

/**
 * Resolve a shape element's geometry. `square` is a diamond rotated a
 * further 45deg (doc 03 (item-generation-pipeline) §6.2's primitives table);
 * `diamond` is the unrotated n=4 polygon.
 */
export function shapeGeometry(shape: ShapeId, cx: number, cy: number, size: number, rotationDeg: number): ShapeGeom {
  switch (shape) {
    case 'circle':
      return { kind: 'circle', cx, cy, r: size / 2 }
    case 'square':
      return { kind: 'polygon', points: polygon(4, cx, cy, size, rotationDeg + 45) }
    case 'diamond':
      return { kind: 'polygon', points: polygon(4, cx, cy, size, rotationDeg) }
    case 'triangle':
      return { kind: 'polygon', points: polygon(3, cx, cy, size, rotationDeg) }
    case 'pentagon':
      return { kind: 'polygon', points: polygon(5, cx, cy, size, rotationDeg) }
    case 'arrow':
      return { kind: 'polygon', points: arrowPoints(cx, cy, size, rotationDeg) }
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
  for (let k = kMin; k <= kMax; k += step) {
    const p0: Pt = [k - EXT, EXT]
    const p1: Pt = [k + EXT, -EXT]
    const clipped = geom.kind === 'circle' ? clipLineToCircle(p0, p1, geom.cx, geom.cy, geom.r) : clipLineToPolygon(p0, p1, geom.points)
    if (clipped && segLength(clipped[0], clipped[1]) >= 3) segs.push(clipped)
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

/** Render a filled/outlined/hatched shape into its constituent tags. */
export function renderFilledGeometry(geom: ShapeGeom, fill: Fill, ink: string, strokeWidth: number, hatchPitch: number): string[] {
  const tags: string[] = []
  const outline = fill !== 'solid' // 'outline' and 'hatched' both draw the boundary stroke-only
  if (geom.kind === 'circle') {
    tags.push(outline ? circleTag(geom.cx, geom.cy, geom.r, 'none', ink, strokeWidth) : circleTag(geom.cx, geom.cy, geom.r, ink))
  } else {
    tags.push(outline ? polygonTag(geom.points, 'none', ink, strokeWidth) : polygonTag(geom.points, ink))
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
      const geom = shapeGeometry(element.shape, cx, cy, SIZE_PX[element.size], element.rotation)
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
  }
}

/**
 * Layout for repeated elements, doc 03-logical-reasoning-design.md §5.1's
 * count convention: 1-3 in a single centred row with 8-unit gaps; 4 = 2+2;
 * 5 = 3+2, top row first, both rows centred (subitisable at a glance).
 */
export function repeatPositions(count: number, size: number): Pt[] {
  const gap = 8
  const rowCounts = count <= 3 ? [count] : count === 4 ? [2, 2] : [3, 2]
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
