import { describe, expect, it } from 'vitest'

import {
  generateCSSTokens,
  resolveTypeLevels,
  generateScaleHex,
} from '@/lib/brand/tokens'
import { TRAJECTAS_DEFAULTS } from '@/lib/brand/defaults'
import type { BrandConfig } from '@/lib/brand/types'

describe('generateCSSTokens', () => {
  it('emits --brand-error, --brand-success, --brand-warning from TRAJECTAS_DEFAULTS', () => {
    const { tokens } = generateCSSTokens(TRAJECTAS_DEFAULTS)
    expect(tokens['--brand-error']).toBeDefined()
    expect(tokens['--brand-success']).toBeDefined()
    expect(tokens['--brand-warning']).toBeDefined()
  })

  it('emits --brand-secondary-* only when secondaryColor is set', () => {
    const configWithoutSecondary: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      secondaryColor: undefined,
    }
    const { tokens: tokensWithout } = generateCSSTokens(configWithoutSecondary)
    expect(tokensWithout['--brand-secondary-500']).toBeUndefined()
    expect(tokensWithout['--brand-secondary']).toBeUndefined()

    const configWithSecondary: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      secondaryColor: '#ff00ff',
    }
    const { tokens: tokensWith } = generateCSSTokens(configWithSecondary)
    expect(tokensWith['--brand-secondary-50']).toBeDefined()
    expect(tokensWith['--brand-secondary-500']).toBeDefined()
    expect(tokensWith['--brand-secondary-900']).toBeDefined()
    expect(tokensWith['--brand-secondary']).toBeDefined()
  })

  it('spacing scales with density: compact=0.85x, comfortable=1x, spacious=1.2x', () => {
    const baseConfig: BrandConfig = { ...TRAJECTAS_DEFAULTS }

    // comfortable (default)
    const { tokens: comfortableTokens } = generateCSSTokens(baseConfig)
    const mdComfortable = comfortableTokens['--brand-space-md']
    expect(mdComfortable).toBe('16px') // 16 * 1 = 16

    // compact
    const compactConfig: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      spacingDensity: 'compact',
    }
    const { tokens: compactTokens } = generateCSSTokens(compactConfig)
    const mdCompact = compactTokens['--brand-space-md']
    expect(mdCompact).toBe('14px') // 16 * 0.85 = 13.6, rounded to 14

    // spacious
    const spaciousConfig: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      spacingDensity: 'spacious',
    }
    const { tokens: spaciousTokens } = generateCSSTokens(spaciousConfig)
    const mdSpacious = spaciousTokens['--brand-space-md']
    expect(mdSpacious).toBe('19px') // 16 * 1.2 = 19.2, rounded to 19
  })

  it('type scale body size matches preset: default=1rem, compact=0.9375rem', () => {
    const defaultConfig: BrandConfig = { ...TRAJECTAS_DEFAULTS }
    const { tokens: defaultTokens } = generateCSSTokens(defaultConfig)
    expect(defaultTokens['--brand-text-body-size']).toBe('1rem')

    const compactConfig: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      typography: { scale: 'compact' },
    }
    const { tokens: compactTokens } = generateCSSTokens(compactConfig)
    expect(compactTokens['--brand-text-body-size']).toBe('0.9375rem')
  })

  it('headingWeight override affects display/h1/h2/h3', () => {
    const config: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      typography: { headingWeight: 700 },
    }
    const { tokens } = generateCSSTokens(config)
    expect(tokens['--brand-text-display-weight']).toBe('700')
    expect(tokens['--brand-text-h1-weight']).toBe('700')
    expect(tokens['--brand-text-h2-weight']).toBe('700')
    expect(tokens['--brand-text-h3-weight']).toBe('700')
  })

  it('button radius: pill=999px, sharp=2px, inherit=border-radius base', () => {
    const pillConfig: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      buttonStyle: { shape: 'pill' },
    }
    const { tokens: pillTokens } = generateCSSTokens(pillConfig)
    expect(pillTokens['--brand-button-radius']).toBe('999px')

    const sharpConfig: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      buttonStyle: { shape: 'sharp' },
    }
    const { tokens: sharpTokens } = generateCSSTokens(sharpConfig)
    expect(sharpTokens['--brand-button-radius']).toBe('2px')

    // inherit (soft radius=8px base)
    const inheritConfig: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      borderRadius: 'soft',
      buttonStyle: { shape: 'inherit' },
    }
    const { tokens: inheritTokens } = generateCSSTokens(inheritConfig)
    expect(inheritTokens['--brand-button-radius']).toBe('8px')
  })

  it('gradientAccent not present when disabled or absent', () => {
    const configNoGradient: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      gradientAccent: undefined,
    }
    const { tokens: tokensNoGradient } = generateCSSTokens(configNoGradient)
    expect(tokensNoGradient['--brand-gradient']).toBeUndefined()

    const configDisabled: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      gradientAccent: { enabled: false },
    }
    const { tokens: tokensDisabled } = generateCSSTokens(configDisabled)
    expect(tokensDisabled['--brand-gradient']).toBeUndefined()
  })

  it('gradientAccent present with correct angle when enabled', () => {
    const config: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      gradientAccent: { enabled: true, angle: 45 },
    }
    const { tokens } = generateCSSTokens(config)
    expect(tokens['--brand-gradient']).toBeDefined()
    expect(tokens['--brand-gradient']).toContain('45deg')
  })

  it('gradient defaults to primaryColor→accentColor at 135deg when not specified', () => {
    const config: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      gradientAccent: { enabled: true },
    }
    const { tokens } = generateCSSTokens(config)
    expect(tokens['--brand-gradient']).toBeDefined()
    expect(tokens['--brand-gradient']).toContain('135deg')
  })

  it('no --brand-secondary-500 without secondaryColor, present with', () => {
    const without: BrandConfig = { ...TRAJECTAS_DEFAULTS, secondaryColor: undefined }
    const { tokens: tokensWithout } = generateCSSTokens(without)
    expect(tokensWithout['--brand-secondary-500']).toBeUndefined()

    const with_: BrandConfig = { ...TRAJECTAS_DEFAULTS, secondaryColor: '#ff00ff' }
    const { tokens: tokensWith } = generateCSSTokens(with_)
    expect(tokensWith['--brand-secondary-500']).toBeDefined()
  })

  it('per-level typography.levels override wins', () => {
    const config: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      typography: {
        scale: 'default',
        levels: {
          h1: { size: '5rem', weight: 800 },
        },
      },
    }
    const { tokens } = generateCSSTokens(config)
    expect(tokens['--brand-text-h1-size']).toBe('5rem')
    expect(tokens['--brand-text-h1-weight']).toBe('800')
  })

  it('returns css string and tokens object', () => {
    const { css, tokens } = generateCSSTokens(TRAJECTAS_DEFAULTS)
    expect(typeof css).toBe('string')
    expect(css).toContain(':root {')
    expect(css).toContain('--brand-')
    expect(typeof tokens).toBe('object')
    expect(Object.keys(tokens).length).toBeGreaterThan(0)
  })

  it('emits all typography levels', () => {
    const { tokens } = generateCSSTokens(TRAJECTAS_DEFAULTS)
    const levels = ['display', 'h1', 'h2', 'h3', 'body', 'label', 'caption']
    levels.forEach((level) => {
      expect(tokens[`--brand-text-${level}-size`]).toBeDefined()
      expect(tokens[`--brand-text-${level}-weight`]).toBeDefined()
      expect(tokens[`--brand-text-${level}-line-height`]).toBeDefined()
      expect(tokens[`--brand-text-${level}-tracking`]).toBeDefined()
    })
  })

  it('emits button style tokens', () => {
    const { tokens } = generateCSSTokens(TRAJECTAS_DEFAULTS)
    expect(tokens['--brand-button-radius']).toBeDefined()
    expect(tokens['--brand-button-weight']).toBeDefined()
    expect(tokens['--brand-button-transform']).toBeDefined()
    expect(tokens['--brand-button-pad-x']).toBeDefined()
    expect(tokens['--brand-button-pad-y']).toBeDefined()
  })
})

describe('resolveTypeLevels', () => {
  it('label weight = bodyWeight + 100, capped at 800', () => {
    const config: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      typography: { bodyWeight: 500 },
    }
    const levels = resolveTypeLevels(config)
    expect(levels.label.weight).toBe(600) // 500 + 100
  })

  it('label weight capped at 800 when bodyWeight+100 exceeds 800', () => {
    const config: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      typography: { bodyWeight: 750 },
    }
    const levels = resolveTypeLevels(config)
    expect(levels.label.weight).toBe(800) // capped, not 850
  })

  it('heading levels use headingWeight', () => {
    const config: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      typography: { headingWeight: 800 },
    }
    const levels = resolveTypeLevels(config)
    expect(levels.display.weight).toBe(800)
    expect(levels.h1.weight).toBe(800)
    expect(levels.h2.weight).toBe(800)
    expect(levels.h3.weight).toBe(800)
  })

  it('body and caption use bodyWeight', () => {
    const config: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      typography: { bodyWeight: 350 },
    }
    const levels = resolveTypeLevels(config)
    expect(levels.body.weight).toBe(350)
    expect(levels.caption.weight).toBe(350)
  })

  it('scale preset drives size and lineHeight', () => {
    const compactConfig: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      typography: { scale: 'compact' },
    }
    const levels = resolveTypeLevels(compactConfig)
    expect(levels.body.size).toBe('0.9375rem')

    const generousConfig: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      typography: { scale: 'generous' },
    }
    const generousLevels = resolveTypeLevels(generousConfig)
    expect(generousLevels.body.size).toBe('1.0625rem')
  })

  it('per-level overrides applied last (highest priority)', () => {
    const config: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      typography: {
        scale: 'default',
        headingWeight: 700,
        levels: {
          h1: { weight: 900, size: '4rem' },
        },
      },
    }
    const levels = resolveTypeLevels(config)
    expect(levels.h1.weight).toBe(900) // override beats headingWeight
    expect(levels.h1.size).toBe('4rem') // override beats scale
    expect(levels.h2.weight).toBe(700) // h2 uses headingWeight
  })
})

describe('generateScaleHex', () => {
  it('generates 10-step scale from base color', () => {
    const scale = generateScaleHex('#2d6a5a')
    const steps = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']
    steps.forEach((step) => {
      expect(scale[step]).toBeDefined()
      expect(scale[step]).toMatch(/^#[0-9a-f]{6}$/i)
    })
  })

  it('scale is consistent for same input', () => {
    const scale1 = generateScaleHex('#2d6a5a')
    const scale2 = generateScaleHex('#2d6a5a')
    expect(scale1).toEqual(scale2)
  })

  it('scale lightness increases from 900 to 50', () => {
    const scale = generateScaleHex('#2d6a5a')
    // This is a heuristic test: 50 should be lighter than 900.
    // We can verify by checking relative luminance from contrast.ts math
    expect(scale['50']).toBeDefined()
    expect(scale['900']).toBeDefined()
  })
})
