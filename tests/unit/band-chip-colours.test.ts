import { describe, it, expect } from 'vitest'
import { getBandColour, getBandTextColour, getBandChipColours } from '@/lib/reports/band-scheme'

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

describe('indicator palette', () => {
  it('uses the neutral terracotta/ochre/sage trio for a 3-band scheme', () => {
    expect(getBandColour('indicator', 0, 3).toLowerCase()).toBe('#b85f52')
    expect(getBandColour('indicator', 1, 3).toLowerCase()).toBe('#c49a4a')
    expect(getBandColour('indicator', 2, 3).toLowerCase()).toBe('#3d8b72')
  })
})

describe('getBandTextColour', () => {
  it('is darker than the band fill for every band', () => {
    for (let i = 0; i < 3; i++) {
      const fill = getBandColour('indicator', i, 3)
      const text = getBandTextColour('indicator', i, 3)
      expect(luminance(text)).toBeLessThan(luminance(fill))
    }
  })
})

describe('getBandChipColours', () => {
  it('returns a light tint background and dark readable text', () => {
    const chip = getBandChipColours('indicator', 2, 3)
    expect(luminance(chip.bg)).toBeGreaterThan(180)
    expect(luminance(chip.text)).toBeLessThan(120)
  })
})
