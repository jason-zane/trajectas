import { describe, expect, it } from 'vitest'

import {
  mergeBrandLayers,
  diffBrandOverrides,
  isEmptyOverrides,
} from '@/lib/brand/merge'
import { TRAJECTAS_DEFAULTS } from '@/lib/brand/defaults'
import type { BrandOverrides, BrandConfig } from '@/lib/brand/types'

describe('mergeBrandLayers', () => {
  it('returns TRAJECTAS_DEFAULTS when all layers are null/undefined', () => {
    const result = mergeBrandLayers([null, undefined, null])
    expect(result).toEqual(TRAJECTAS_DEFAULTS)
  })

  it('returns TRAJECTAS_DEFAULTS when layers array is empty', () => {
    const result = mergeBrandLayers([])
    expect(result).toEqual(TRAJECTAS_DEFAULTS)
  })

  it('later layer wins for top-level fields', () => {
    const layer1: BrandOverrides = { primaryColor: '#ff0000' }
    const layer2: BrandOverrides = { primaryColor: '#00ff00' }
    const result = mergeBrandLayers([layer1, layer2])
    expect(result.primaryColor).toBe('#00ff00')
  })

  it('undefined field values in a layer are skipped', () => {
    const layer1: BrandOverrides = { primaryColor: '#ff0000', name: 'Layer1' }
    const layer2: BrandOverrides = { primaryColor: undefined }
    const result = mergeBrandLayers([layer1, layer2])
    expect(result.primaryColor).toBe('#ff0000')
    expect(result.name).toBe('Layer1')
  })

  it('null field values in a layer are skipped', () => {
    const layer1: BrandOverrides = { primaryColor: '#ff0000' }
    const layer2: BrandOverrides = { primaryColor: null as unknown as undefined }
    const result = mergeBrandLayers([layer1, layer2])
    expect(result.primaryColor).toBe('#ff0000')
  })

  it('empty string logoUrl IS applied (meaningful override)', () => {
    const layer1: BrandOverrides = { logoUrl: 'https://example.com/logo.png' }
    const layer2: BrandOverrides = { logoUrl: '' }
    const result = mergeBrandLayers([layer1, layer2])
    expect(result.logoUrl).toBe('')
  })

  it('nested groups are atomic — whole group replaces when set', () => {
    const layer1: BrandOverrides = {
      semanticColors: {
        destructive: '#ff0000',
        success: '#00ff00',
        warning: '#ffff00',
      },
    }
    const layer2: BrandOverrides = {
      semanticColors: {
        destructive: '#cc0000',
        success: '#00cc00',
        warning: '#cccc00',
      },
    }
    const result = mergeBrandLayers([layer1, layer2])
    expect(result.semanticColors).toEqual(layer2.semanticColors)
    expect(result.semanticColors).not.toEqual(layer1.semanticColors)
  })

  it('partial nested group object in layer replaces entire inherited group', () => {
    const layer1: BrandOverrides = {
      taxonomyColors: {
        dimension: '#5b3fc5',
        competency: '#2d6a5a',
        trait: '#a33fa3',
        item: '#c27803',
      },
    }
    const layer2: BrandOverrides = {
      taxonomyColors: {
        dimension: '#111111',
        // competency, trait, item omitted in layer2
      } as unknown as typeof TRAJECTAS_DEFAULTS.taxonomyColors,
    }
    const result = mergeBrandLayers([layer1, layer2])
    // The entire taxonomyColors group is replaced, not merged shallowly
    expect(result.taxonomyColors?.competency).toBeUndefined()
    expect(result.taxonomyColors?.dimension).toBe('#111111')
  })

  it('result is a fresh object (mutations do not affect TRAJECTAS_DEFAULTS)', () => {
    const result = mergeBrandLayers([{ primaryColor: '#ff0000' }])
    result.primaryColor = '#00ff00'
    result.name = 'Modified'
    expect(TRAJECTAS_DEFAULTS.primaryColor).not.toBe('#00ff00')
    expect(TRAJECTAS_DEFAULTS.name).not.toBe('Modified')
  })

  it('preserves nested group defaults when not overridden', () => {
    const layer1: BrandOverrides = { primaryColor: '#ff0000' }
    const result = mergeBrandLayers([layer1])
    expect(result.semanticColors).toEqual(TRAJECTAS_DEFAULTS.semanticColors)
    expect(result.portalAccents).toEqual(TRAJECTAS_DEFAULTS.portalAccents)
  })

  it('handles multiple layers in cascade order', () => {
    const base: BrandOverrides = { primaryColor: '#111111', name: 'Base' }
    const layer1: BrandOverrides = { accentColor: '#222222' }
    const layer2: BrandOverrides = { primaryColor: '#333333' }
    const layer3: BrandOverrides = { name: 'Final' }
    const result = mergeBrandLayers([base, layer1, layer2, layer3])
    expect(result.primaryColor).toBe('#333333')
    expect(result.accentColor).toBe('#222222')
    expect(result.name).toBe('Final')
  })
})

describe('diffBrandOverrides', () => {
  it('returns empty object when inherited and candidate are identical', () => {
    const config = { ...TRAJECTAS_DEFAULTS }
    const diff = diffBrandOverrides(config, config)
    expect(diff).toEqual({})
  })

  it('returns only changed fields', () => {
    const inherited = { ...TRAJECTAS_DEFAULTS }
    const candidate = {
      ...TRAJECTAS_DEFAULTS,
      primaryColor: '#ff0000',
      name: 'Custom',
    }
    const diff = diffBrandOverrides(inherited, candidate)
    expect(diff.primaryColor).toBe('#ff0000')
    expect(diff.name).toBe('Custom')
    expect(Object.keys(diff).length).toBe(2)
  })

  it('includes nested group when changed', () => {
    const inherited = { ...TRAJECTAS_DEFAULTS }
    const candidate = {
      ...TRAJECTAS_DEFAULTS,
      semanticColors: {
        destructive: '#ff0000',
        success: '#00ff00',
        warning: '#ffff00',
      },
    }
    const diff = diffBrandOverrides(inherited, candidate)
    expect(diff.semanticColors).toBeDefined()
    expect(diff.semanticColors).toEqual(candidate.semanticColors)
  })

  it('skips undefined fields in candidate', () => {
    const inherited = { ...TRAJECTAS_DEFAULTS }
    const candidate = {
      ...TRAJECTAS_DEFAULTS,
      primaryColor: '#ff0000',
      secondaryColor: undefined,
    }
    const diff = diffBrandOverrides(inherited, candidate)
    expect(diff.primaryColor).toBe('#ff0000')
    expect(diff.secondaryColor).toBeUndefined()
  })

  it('uses JSON stringification for comparison', () => {
    // JSON.stringify actually includes key order differences,
    // so this test documents that behavior:
    interface CustomConfig {
      [key: string]: unknown
    }
    const inherited = {
      ...TRAJECTAS_DEFAULTS,
      customField: { a: 1, b: 2 },
    } as unknown as BrandConfig
    const candidate = {
      ...TRAJECTAS_DEFAULTS,
      customField: { b: 2, a: 1 }, // different order
    } as unknown as BrandConfig
    const diff = diffBrandOverrides(inherited, candidate)
    // JSON.stringify on {a:1,b:2} !== JSON.stringify on {b:2,a:1}
    expect(JSON.stringify({ a: 1, b: 2 })).not.toBe(JSON.stringify({ b: 2, a: 1 }))
    const diffRecord = diff as unknown as CustomConfig
    expect(diffRecord.customField).toBeDefined() // caught as a diff
  })

  it('detects change in empty string vs undefined', () => {
    const inherited = { ...TRAJECTAS_DEFAULTS, logoUrl: undefined }
    const candidate = { ...TRAJECTAS_DEFAULTS, logoUrl: '' }
    const diff = diffBrandOverrides(inherited, candidate)
    expect(diff.logoUrl).toBe('')
  })

  it('detects addition of optional field', () => {
    const inherited = { ...TRAJECTAS_DEFAULTS, secondaryColor: undefined }
    const candidate = { ...TRAJECTAS_DEFAULTS, secondaryColor: '#ff00ff' }
    const diff = diffBrandOverrides(inherited, candidate)
    expect(diff.secondaryColor).toBe('#ff00ff')
  })
})

describe('isEmptyOverrides', () => {
  it('returns true for empty object', () => {
    expect(isEmptyOverrides({})).toBe(true)
  })

  it('returns true when all values are undefined', () => {
    const overrides: BrandOverrides = {
      primaryColor: undefined,
      name: undefined,
      semanticColors: undefined,
    }
    expect(isEmptyOverrides(overrides)).toBe(true)
  })

  it('returns false when any field is defined', () => {
    const overrides: BrandOverrides = {
      primaryColor: '#ff0000',
      name: undefined,
    }
    expect(isEmptyOverrides(overrides)).toBe(false)
  })

  it('returns false when nested group is defined', () => {
    const overrides: BrandOverrides = {
      semanticColors: {
        destructive: '#ff0000',
        success: '#00ff00',
        warning: '#ffff00',
      },
    }
    expect(isEmptyOverrides(overrides)).toBe(false)
  })

  it('returns false when empty string logoUrl is set (meaningful override)', () => {
    const overrides: BrandOverrides = { logoUrl: '' }
    expect(isEmptyOverrides(overrides)).toBe(false)
  })
})
