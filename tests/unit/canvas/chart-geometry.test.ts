import { describe, expect, it } from 'vitest'
import { monoPath } from '@/lib/canvas/chart-geometry'

function parseCubics(d: string): { c1y: number; c2y: number; endY: number }[] {
  const out: { c1y: number; c2y: number; endY: number }[] = []
  const re = /C(-?[\d.]+),(-?[\d.]+) (-?[\d.]+),(-?[\d.]+) (-?[\d.]+),(-?[\d.]+)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(d)) !== null) {
    out.push({ c1y: Number(match[2]), c2y: Number(match[4]), endY: Number(match[6]) })
  }
  return out
}

describe('monoPath', () => {
  it('handles degenerate inputs', () => {
    expect(monoPath([])).toBe('')
    expect(monoPath([{ x: 1, y: 2 }])).toBe('M1.00,2.00')
  })

  it('emits one cubic per interval', () => {
    const d = monoPath([
      { x: 0, y: 0 },
      { x: 10, y: 5 },
      { x: 20, y: 3 },
    ])
    expect(d.startsWith('M0.00,0.00')).toBe(true)
    expect(parseCubics(d)).toHaveLength(2)
  })

  it('does not overshoot a sharp flattening (Fritsch–Carlson limiter)', () => {
    // 0 → 100 → 101: unlimited tangent averaging gives the middle point a
    // tangent of ~50, bulging the second segment far above 101.
    const d = monoPath([
      { x: 0, y: 0 },
      { x: 10, y: 100 },
      { x: 20, y: 101 },
    ])
    const segments = parseCubics(d)
    const last = segments[segments.length - 1]
    // Control points of a monotone segment must stay within its y-range —
    // the cubic is then bounded by [100, 101].
    expect(last.c1y).toBeGreaterThanOrEqual(100)
    expect(last.c1y).toBeLessThanOrEqual(101)
    expect(last.c2y).toBeGreaterThanOrEqual(100)
    expect(last.c2y).toBeLessThanOrEqual(101)
  })

  it('keeps flat runs perfectly flat', () => {
    const d = monoPath([
      { x: 0, y: 50 },
      { x: 10, y: 50 },
      { x: 20, y: 80 },
    ])
    const [flat] = parseCubics(d)
    expect(flat.c1y).toBe(50)
    expect(flat.c2y).toBe(50)
    expect(flat.endY).toBe(50)
  })
})
