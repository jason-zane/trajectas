/**
 * Pure chart-geometry helpers shared by the interactive trajectory timeline
 * (client) and the growth-report print renderer (server).
 */

/**
 * Monotone cubic interpolation (Fritsch–Carlson tangents). Smooth, but the
 * curve never overshoots a measured value — psychometrically honest, no
 * invented peaks between sessions.
 */
export function monoPath(pts: { x: number; y: number }[]): string {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`
  const dx: number[] = []
  const dy: number[] = []
  const m: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x)
    dy.push(pts[i + 1].y - pts[i].y)
    m.push(dx[i] === 0 ? 0 : dy[i] / dx[i])
  }
  const t: number[] = [m[0]]
  for (let i = 1; i < n - 1; i++) {
    t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2)
  }
  t.push(m[n - 2])
  // Fritsch–Carlson limiter: clamp tangents so no cubic segment overshoots
  // its endpoints (averaging alone lets a sharp flattening — e.g. 0→100→101 —
  // bulge past the measured value).
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0
      t[i + 1] = 0
      continue
    }
    const a = t[i] / m[i]
    const b = t[i + 1] / m[i]
    const h = Math.hypot(a, b)
    if (h > 3) {
      const f = 3 / h
      t[i] = f * t[i]
      t[i + 1] = f * t[i + 1]
    }
  }
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i]
    d +=
      ` C${(pts[i].x + h / 3).toFixed(2)},${(pts[i].y + (t[i] * h) / 3).toFixed(2)}` +
      ` ${(pts[i + 1].x - h / 3).toFixed(2)},${(pts[i + 1].y - (t[i + 1] * h) / 3).toFixed(2)}` +
      ` ${pts[i + 1].x.toFixed(2)},${pts[i + 1].y.toFixed(2)}`
  }
  return d
}
