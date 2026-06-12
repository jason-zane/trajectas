import { describe, it, expect } from 'vitest'
import { computePageMap, type PageUnit } from '@/lib/reports/pagination'

const PAGE = 1000

function unit(top: number, height: number, extra: Partial<PageUnit> = {}): PageUnit {
  return { top, height, ...extra }
}

describe('computePageMap', () => {
  it('puts everything on one page when it fits', () => {
    const map = computePageMap(
      [unit(0, 200, { targetId: 'a' }), unit(300, 400, { targetId: 'b' })],
      PAGE,
      800,
    )
    expect(map.pageCount).toBe(1)
    expect(map.breakOffsets).toEqual([])
    expect(map.pageByTarget).toEqual({ a: 1, b: 1 })
  })

  it('fills pages naturally as flow content runs past boundaries', () => {
    const map = computePageMap(
      [unit(0, 300), unit(1200, 300, { targetId: 'late' })],
      PAGE,
      1600,
    )
    expect(map.pageCount).toBe(2)
    expect(map.breakOffsets).toEqual([1000])
    expect(map.pageByTarget.late).toBe(2)
  })

  it('pushes atomic units that would straddle a boundary', () => {
    const map = computePageMap(
      [unit(0, 100), unit(900, 300, { atomic: true, targetId: 'pushed' })],
      PAGE,
      1300,
    )
    // The atomic unit starts at 900 and would end at 1200 — pushed, so the
    // new page begins at its top.
    expect(map.breakOffsets).toEqual([900])
    expect(map.pageByTarget.pushed).toBe(2)
    expect(map.pageCount).toBe(2)
  })

  it('lets oversized atomic units split rather than looping forever', () => {
    const map = computePageMap(
      [unit(0, 100), unit(200, 2400, { atomic: true })],
      PAGE,
      2700,
    )
    // Taller than a page — cannot be pushed into fitting; flows across.
    expect(map.pageCount).toBe(3)
    expect(map.breakOffsets).toEqual([1000, 2000])
  })

  it('honours breakBefore except at the top of a page', () => {
    const atTop = computePageMap([unit(0, 200, { breakBefore: true })], PAGE, 300)
    expect(atTop.pageCount).toBe(1)

    const midPage = computePageMap(
      [unit(0, 200), unit(400, 200, { breakBefore: true, targetId: 'forced' })],
      PAGE,
      700,
    )
    expect(midPage.breakOffsets).toEqual([400])
    expect(midPage.pageByTarget.forced).toBe(2)
  })

  it('treats full-page units as consuming exactly one page', () => {
    // Cover measured at only 420px on screen, but the next content still
    // starts page 2 at its own top.
    const map = computePageMap(
      [unit(0, 420, { fullPage: true, targetId: 'cover' }), unit(420, 300, { targetId: 'after' })],
      PAGE,
      900,
    )
    expect(map.pageByTarget.cover).toBe(1)
    expect(map.pageByTarget.after).toBe(2)
    expect(map.breakOffsets).toEqual([420])
    expect(map.pageCount).toBe(2)
  })

  it('counts trailing flow content past the last unit', () => {
    const map = computePageMap([unit(0, 100)], PAGE, 2500)
    expect(map.pageCount).toBe(3)
    expect(map.breakOffsets).toEqual([1000, 2000])
  })

  it('re-anchors a section target when its first atomic entry is pushed', () => {
    // Section wrapper starts near the bottom of page 1 (header only fits);
    // its first score entry would straddle and is pushed to page 2. The TOC
    // must point at page 2, where the visible section actually starts.
    const map = computePageMap(
      [
        unit(0, 100),
        unit(880, 400, { targetId: 'section' }),
        unit(940, 200, { atomic: true }),
      ],
      PAGE,
      1300,
    )
    expect(map.breakOffsets).toEqual([940])
    expect(map.pageByTarget.section).toBe(2)
  })

  it('does not re-anchor a target once real content rendered before the push', () => {
    // The section started high on page 1 with plenty of content; a later
    // entry being pushed must not drag the section's TOC entry forward.
    const map = computePageMap(
      [
        unit(100, 800, { targetId: 'section' }),
        unit(150, 200, { atomic: true }),
        unit(900, 200, { atomic: true }),
      ],
      PAGE,
      1300,
    )
    expect(map.pageByTarget.section).toBe(1)
    expect(map.breakOffsets).toEqual([900])
  })

  it('keeps the first page number per target', () => {
    const map = computePageMap(
      [unit(0, 100, { targetId: 'dup' }), unit(1200, 100, { targetId: 'dup' })],
      PAGE,
      1400,
    )
    expect(map.pageByTarget.dup).toBe(1)
  })

  it('returns a single page for degenerate page heights', () => {
    const map = computePageMap([unit(0, 100)], 0, 100)
    expect(map.pageCount).toBe(1)
  })
})
