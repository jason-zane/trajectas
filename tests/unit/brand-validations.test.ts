import { describe, expect, it } from 'vitest'

import {
  brandConfigSchema,
  brandOverridesSchema,
} from '@/lib/validations/brand'
import { TRAJECTAS_DEFAULTS } from '@/lib/brand/defaults'

describe('brandConfigSchema', () => {
  it('accepts TRAJECTAS_DEFAULTS (pins that reportTheme is not stripped)', () => {
    const result = brandConfigSchema.safeParse(TRAJECTAS_DEFAULTS)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.reportTheme).toBeDefined()
      expect(result.data.reportTheme).toEqual(TRAJECTAS_DEFAULTS.reportTheme)
    }
  })

  it('rejects invalid hex color in primaryColor', () => {
    const config = {
      ...TRAJECTAS_DEFAULTS,
      primaryColor: 'invalid',
    }
    const result = brandConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('rejects invalid hex color in secondaryColor', () => {
    const config = {
      ...TRAJECTAS_DEFAULTS,
      secondaryColor: 'not-a-hex',
    }
    const result = brandConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('accepts valid hex secondaryColor', () => {
    const config = {
      ...TRAJECTAS_DEFAULTS,
      secondaryColor: '#ff00ff',
    }
    const result = brandConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('rejects gradient angle > 360', () => {
    const config = {
      ...TRAJECTAS_DEFAULTS,
      gradientAccent: { enabled: true, angle: 400 },
    }
    const result = brandConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('rejects gradient angle < 0', () => {
    const config = {
      ...TRAJECTAS_DEFAULTS,
      gradientAccent: { enabled: true, angle: -45 },
    }
    const result = brandConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('accepts gradient angle 0–360', () => {
    const config = {
      ...TRAJECTAS_DEFAULTS,
      gradientAccent: { enabled: true, angle: 135 },
    }
    const result = brandConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('rejects headingWeight > 800', () => {
    const config = {
      ...TRAJECTAS_DEFAULTS,
      typography: { headingWeight: 900 },
    }
    const result = brandConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('rejects headingWeight < 300', () => {
    const config = {
      ...TRAJECTAS_DEFAULTS,
      typography: { headingWeight: 200 },
    }
    const result = brandConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('accepts headingWeight 300–800', () => {
    const config = {
      ...TRAJECTAS_DEFAULTS,
      typography: { headingWeight: 600 },
    }
    const result = brandConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('accepts rgba() strings in reportTheme fields', () => {
    const config = {
      ...TRAJECTAS_DEFAULTS,
      reportTheme: {
        ...TRAJECTAS_DEFAULTS.reportTheme,
        reportHighBandFill: 'rgba(255, 0, 0, 0.5)',
      },
    }
    const result = brandConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('rejects <script> in reportTheme color (XSS prevention)', () => {
    const config = {
      ...TRAJECTAS_DEFAULTS,
      reportTheme: {
        ...TRAJECTAS_DEFAULTS.reportTheme,
        reportHighBandFill: '<script>alert(1)</script>',
      },
    }
    const result = brandConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('accepts color functions matching the permissive reportColor regex', () => {
    // The reportColor regex is intentionally permissive to allow various CSS color formats
    // including rgba(), hsl(), hex, named colors etc. This test documents that.
    const config = {
      ...TRAJECTAS_DEFAULTS,
      reportTheme: {
        ...TRAJECTAS_DEFAULTS.reportTheme,
        reportHighBandFill: 'hsl(0, 100%, 50%)',
      },
    }
    const result = brandConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('requires name field (not optional)', () => {
    const config: Partial<typeof TRAJECTAS_DEFAULTS> = {
      ...TRAJECTAS_DEFAULTS,
      name: undefined,
    }
    const result = brandConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('requires primaryColor field (not optional)', () => {
    const config: Partial<typeof TRAJECTAS_DEFAULTS> = {
      ...TRAJECTAS_DEFAULTS,
      primaryColor: undefined,
    }
    const result = brandConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('accepts full config with optional fields populated', () => {
    const config = {
      ...TRAJECTAS_DEFAULTS,
      secondaryColor: '#ff00ff',
      portalAccents: {
        admin: '#111111',
        partner: '#222222',
        client: '#333333',
      },
      gradientAccent: { enabled: true, angle: 90 },
    }
    const result = brandConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })
})

describe('brandOverridesSchema', () => {
  it('accepts empty object', () => {
    const result = brandOverridesSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts single-field override {primaryColor}', () => {
    const result = brandOverridesSchema.safeParse({
      primaryColor: '#ff0000',
    })
    expect(result.success).toBe(true)
  })

  it('accepts nested partial group {buttonStyle: {shape: "pill"}}', () => {
    const result = brandOverridesSchema.safeParse({
      buttonStyle: {
        shape: 'pill',
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid field values', () => {
    const result = brandOverridesSchema.safeParse({
      primaryColor: 'invalid-hex',
    })
    expect(result.success).toBe(false)
  })

  it('round-trips partial config {primaryColor, buttonStyle: {shape}}', () => {
    const partial = {
      primaryColor: '#ff0000',
      buttonStyle: {
        shape: 'pill' as const,
      },
    }
    const result = brandOverridesSchema.safeParse(partial)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.primaryColor).toBe('#ff0000')
      expect(result.data.buttonStyle?.shape).toBe('pill')
    }
  })

  it('allows all fields to be optional', () => {
    const result = brandOverridesSchema.safeParse({
      name: 'Custom Name',
      // everything else omitted
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid semanticColors', () => {
    const result = brandOverridesSchema.safeParse({
      semanticColors: {
        destructive: 'bad-color',
        success: '#00ff00',
        warning: '#ffff00',
      },
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid semanticColors override', () => {
    const result = brandOverridesSchema.safeParse({
      semanticColors: {
        destructive: '#ff0000',
        success: '#00ff00',
        warning: '#ffff00',
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid borderRadius', () => {
    const result = brandOverridesSchema.safeParse({
      borderRadius: 'invalid',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid borderRadius values', () => {
    const validValues = ['sharp', 'soft', 'round'] as const
    validValues.forEach((value) => {
      const result = brandOverridesSchema.safeParse({
        borderRadius: value,
      })
      expect(result.success).toBe(true)
    })
  })

  it('rejects invalid spacingDensity', () => {
    const result = brandOverridesSchema.safeParse({
      spacingDensity: 'ultracompact',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid spacingDensity values', () => {
    const validValues = ['compact', 'comfortable', 'spacious'] as const
    validValues.forEach((value) => {
      const result = brandOverridesSchema.safeParse({
        spacingDensity: value,
      })
      expect(result.success).toBe(true)
    })
  })

  it('accepts complex partial override combining multiple fields', () => {
    const result = brandOverridesSchema.safeParse({
      primaryColor: '#2d6a5a',
      accentColor: '#c9a962',
      typography: {
        scale: 'default',
        headingWeight: 700,
      },
      buttonStyle: {
        shape: 'pill',
        weight: 600,
      },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.primaryColor).toBe('#2d6a5a')
      expect(result.data.typography?.headingWeight).toBe(700)
      expect(result.data.buttonStyle?.shape).toBe('pill')
    }
  })

  it('does not strip valid fields during parse', () => {
    const input = {
      primaryColor: '#ff0000',
      accentColor: '#00ff00',
      semanticColors: {
        destructive: '#cc0000',
        success: '#00cc00',
        warning: '#cccc00',
      },
    }
    const result = brandOverridesSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.primaryColor).toBe('#ff0000')
      expect(result.data.accentColor).toBe('#00ff00')
      expect(result.data.semanticColors?.destructive).toBe('#cc0000')
    }
  })
})
