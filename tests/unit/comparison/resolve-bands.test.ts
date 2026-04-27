import { describe, it, expect } from 'vitest'
import { buildCellStyleResolver } from '@/lib/comparison/resolve-bands'
import { DEFAULT_3_BAND_SCHEME } from '@/lib/reports/band-scheme'

describe('buildCellStyleResolver', () => {
  it('returns a style with backgroundColor for an in-band score', () => {
    const get = buildCellStyleResolver({
      partner: null,
      platform: { bandScheme: DEFAULT_3_BAND_SCHEME },
    })
    const style = get(80)
    expect(style.backgroundColor).toBeTruthy()
  })

  it('returns an empty style for null', () => {
    const get = buildCellStyleResolver({
      partner: null,
      platform: { bandScheme: DEFAULT_3_BAND_SCHEME },
    })
    expect(get(null)).toEqual({})
  })

  it('clamps scores to [0, 100]', () => {
    const get = buildCellStyleResolver({
      partner: null,
      platform: { bandScheme: DEFAULT_3_BAND_SCHEME },
    })
    expect(get(150).backgroundColor).toBeTruthy()
    expect(get(-5).backgroundColor).toBeTruthy()
  })

  it('falls back to the default scheme when nothing is provided', () => {
    const get = buildCellStyleResolver({ partner: null, platform: { bandScheme: null } })
    expect(get(50).backgroundColor).toBeTruthy()
  })
})
