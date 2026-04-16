import { describe, it, expect } from 'vitest'
import { getBandColour } from '@/lib/reports/band-scheme'

describe('getBandColour — generalised multi-stop interpolation', () => {
  // red-amber-green is 3-stop: #c62828, #e67a00, #2e7d32
  it('returns first stop at bandIndex 0', () => {
    expect(getBandColour('red-amber-green', 0, 3).toLowerCase()).toBe('#c62828')
  })

  it('returns middle stop at the midpoint for a 3-band scheme', () => {
    expect(getBandColour('red-amber-green', 1, 3).toLowerCase()).toBe('#e67a00')
  })

  it('returns last stop at bandIndex == bandCount - 1', () => {
    expect(getBandColour('red-amber-green', 2, 3).toLowerCase()).toBe('#2e7d32')
  })

  it('interpolates between consecutive stops', () => {
    // halfway between red and amber (not the exact amber midpoint)
    const result = getBandColour('red-amber-green', 1, 5).toLowerCase()
    expect(result).not.toBe('#c62828')
    expect(result).not.toBe('#e67a00')
  })

  it('handles 2-stop palettes (blue-scale)', () => {
    expect(getBandColour('blue-scale', 0, 3).toLowerCase()).toBe('#90caf9')
    expect(getBandColour('blue-scale', 2, 3).toLowerCase()).toBe('#0d47a1')
  })

  it('returns the single stop when bandCount is 1', () => {
    expect(getBandColour('red-amber-green', 0, 1).toLowerCase()).toBe('#c62828')
  })
})

describe('soft-rag palette', () => {
  it('exposes 3 stops and uses the midpoint as amber', () => {
    expect(getBandColour('soft-rag', 0, 3).toLowerCase()).toBe('#c78a8a')
    expect(getBandColour('soft-rag', 1, 3).toLowerCase()).toBe('#d7b26a')
    expect(getBandColour('soft-rag', 2, 3).toLowerCase()).toBe('#7aa87a')
  })
})

describe('sage-ladder palette', () => {
  it('returns each of the 5 stops at clean offsets', () => {
    expect(getBandColour('sage-ladder', 0, 5).toLowerCase()).toBe('#64748b')
    expect(getBandColour('sage-ladder', 1, 5).toLowerCase()).toBe('#60a5fa')
    expect(getBandColour('sage-ladder', 2, 5).toLowerCase()).toBe('#14b8a6')
    expect(getBandColour('sage-ladder', 3, 5).toLowerCase()).toBe('#84cc16')
    expect(getBandColour('sage-ladder', 4, 5).toLowerCase()).toBe('#22c55e')
  })

  it('works for 3-band schemes (samples stops 0, 2, 4)', () => {
    expect(getBandColour('sage-ladder', 0, 3).toLowerCase()).toBe('#64748b')
    expect(getBandColour('sage-ladder', 2, 3).toLowerCase()).toBe('#22c55e')
  })
})
