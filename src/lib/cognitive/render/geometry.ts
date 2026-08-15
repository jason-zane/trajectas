import 'server-only'

/**
 * Pure coordinate geometry for the SVG renderer. Doc 03
 * (item-generation-pipeline) §6.2: all coordinates are computed absolutely in
 * TypeScript and emitted as literals — no `transform` attributes, no nested
 * transform stacks. A rotated shape is emitted as rotated points, not a
 * `<polygon>` inside a `rotate()`, because accumulated float transforms would
 * make the SVG string (and therefore the content hash and the raster)
 * dependent on evaluation order.
 */

export type Pt = [number, number]

/** Rotate (x,y) about (cx,cy) by theta degrees clockwise. */
export function rot(x: number, y: number, cx: number, cy: number, deg: number): Pt {
  const t = (deg * Math.PI) / 180
  const s = Math.sin(t)
  const c = Math.cos(t)
  const dx = x - cx
  const dy = y - cy
  return [cx + dx * c - dy * s, cy + dx * s + dy * c]
}

/**
 * Regular n-gon, apex up (n odd) / point-up diamond orientation (n even, at
 * rotation 0), bounding-box WIDTH = size at the canonical orientation used by
 * each shape's own call site (see render/primitives.ts).
 */
export function polygon(n: number, cx: number, cy: number, size: number, deg: number): Pt[] {
  const halfWidth =
    n % 2 === 0
      ? Math.cos(Math.PI / n) // even n: vertices span the width
      : Math.sin((Math.PI * Math.floor(n / 2)) / n) // odd n: widest chord
  const R = size / (2 * halfWidth)
  return Array.from({ length: n }, (_, i) => {
    const a = -90 + (360 / n) * i
    return rot(cx + R * Math.cos((a * Math.PI) / 180), cy + R * Math.sin((a * Math.PI) / 180), cx, cy, deg)
  })
}

/** Fixed number formatting — the single source of truth for hash/render stability. */
export function fmt(n: number): string {
  const r = Math.round(n * 1000) / 1000
  return Object.is(r, -0) ? '0' : String(r)
}

/** Euclidean length of a two-point segment, in canvas units. */
export function segLength(a: Pt, b: Pt): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}

/**
 * Signed polygon area (shoelace). Sign encodes winding direction; used by
 * clipLineToPolygon to determine the inward-normal direction without relying
 * on the caller's vertex order.
 */
export function signedArea(points: readonly Pt[]): number {
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    area += x1 * y2 - x2 * y1
  }
  return area / 2
}

/**
 * Clip the infinite line through p0/p1 to a convex polygon (Cyrus-Beck).
 * Returns the two intersection points (line-clipped-to-polygon segment), or
 * null when the line misses the polygon entirely. Orientation-agnostic: the
 * inward-normal direction is derived from `signedArea`, so it is correct
 * regardless of whether `points` winds clockwise or anticlockwise.
 */
export function clipLineToPolygon(p0: Pt, p1: Pt, points: readonly Pt[]): [Pt, Pt] | null {
  const orient = signedArea(points) >= 0 ? 1 : -1
  let tE = 0
  let tL = 1
  const dx = p1[0] - p0[0]
  const dy = p1[1] - p0[1]
  const n = points.length
  for (let i = 0; i < n; i++) {
    const a = points[i]
    const b = points[(i + 1) % n]
    const ex = b[0] - a[0]
    const ey = b[1] - a[1]
    // Inward normal, oriented so it points into the polygon regardless of
    // winding direction (flipped by `orient`).
    const nx = orient > 0 ? -ey : ey
    const ny = orient > 0 ? ex : -ex
    const D = nx * dx + ny * dy
    const N = nx * (a[0] - p0[0]) + ny * (a[1] - p0[1])
    // Scale-invariant "is this edge parallel to the line" test. D and N are
    // both magnitude ~|edge| * |direction|, so an absolute epsilon breaks at
    // the coordinate scales this renderer actually uses (hatch lines are
    // extended +-1000 units to guarantee full coverage — see primitives.ts
    // hatchSegments — which pushes D for a genuinely-parallel edge to ~1e5,
    // well past a fixed 1e-9 floor given ordinary floating-point rounding in
    // the edge vector itself).
    const scale = Math.hypot(ex, ey) * Math.hypot(dx, dy) + 1e-12
    if (Math.abs(D) < 1e-9 * scale) {
      // Inward-half-plane test for a line parallel to this edge is
      // n.(p0-a) >= 0, i.e. -N >= 0, i.e. N <= 0 (N is defined above as
      // n.(a-p0)). N > 0 means the entire line sits outside this edge.
      if (N > 0) return null
      continue
    }
    const t = N / D
    if (D > 0) {
      if (t > tL) return null
      if (t > tE) tE = t
    } else {
      if (t < tE) return null
      if (t < tL) tL = t
    }
  }
  if (tE > tL) return null
  return [
    [p0[0] + tE * dx, p0[1] + tE * dy],
    [p0[0] + tL * dx, p0[1] + tL * dy],
  ]
}

/** Clip the infinite line through p0/p1 to a circle. Returns the chord, or null when it misses. */
export function clipLineToCircle(p0: Pt, p1: Pt, cx: number, cy: number, r: number): [Pt, Pt] | null {
  const dx = p1[0] - p0[0]
  const dy = p1[1] - p0[1]
  const fx = p0[0] - cx
  const fy = p0[1] - cy
  const a = dx * dx + dy * dy
  const b = 2 * (fx * dx + fy * dy)
  const c = fx * fx + fy * fy - r * r
  const disc = b * b - 4 * a * c
  if (disc < 0) return null
  const sq = Math.sqrt(disc)
  let t0 = (-b - sq) / (2 * a)
  let t1 = (-b + sq) / (2 * a)
  t0 = Math.max(0, t0)
  t1 = Math.min(1, t1)
  if (t0 > t1) return null
  return [
    [p0[0] + t0 * dx, p0[1] + t0 * dy],
    [p0[0] + t1 * dx, p0[1] + t1 * dy],
  ]
}
