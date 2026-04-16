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
