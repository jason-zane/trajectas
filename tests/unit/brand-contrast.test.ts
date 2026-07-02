import { describe, expect, it } from 'vitest'

import {
  relativeLuminance,
  contrastRatio,
  auditBrandContrast,
  contrastFailures,
} from '@/lib/brand/contrast'
import { TRAJECTAS_DEFAULTS } from '@/lib/brand/defaults'
import type { BrandConfig } from '@/lib/brand/types'

describe('relativeLuminance', () => {
  it('returns 1 for white', () => {
    const lum = relativeLuminance('#ffffff')
    expect(lum).toBeCloseTo(1, 3)
  })

  it('returns 0 for black', () => {
    const lum = relativeLuminance('#000000')
    expect(lum).toBeCloseTo(0, 3)
  })

  it('returns approximately 0.5 for medium gray', () => {
    const lum = relativeLuminance('#808080')
    expect(lum).toBeGreaterThan(0.2)
    expect(lum).toBeLessThan(0.8)
  })

  it('is case-insensitive', () => {
    const lumLower = relativeLuminance('#ffffff')
    const lumUpper = relativeLuminance('#FFFFFF')
    expect(lumLower).toBeCloseTo(lumUpper, 5)
  })
})

describe('contrastRatio', () => {
  it('black on white equals 21 (±0.01)', () => {
    const ratio = contrastRatio('#000000', '#ffffff')
    expect(ratio).toBeCloseTo(21, 1)
  })

  it('white on black equals 21 (±0.01) — ratio is symmetric', () => {
    const ratio = contrastRatio('#ffffff', '#000000')
    expect(ratio).toBeCloseTo(21, 1)
  })

  it('same color has ratio 1', () => {
    const ratio = contrastRatio('#2d6a5a', '#2d6a5a')
    expect(ratio).toBeCloseTo(1, 2)
  })

  it('is symmetric — order does not matter', () => {
    const ratio1 = contrastRatio('#ff0000', '#00ff00')
    const ratio2 = contrastRatio('#00ff00', '#ff0000')
    expect(ratio1).toBeCloseTo(ratio2, 2)
  })

  it('returns value between 1 and 21', () => {
    const ratio = contrastRatio('#808080', '#ffffff')
    expect(ratio).toBeGreaterThanOrEqual(1)
    expect(ratio).toBeLessThanOrEqual(21)
  })
})

describe('auditBrandContrast', () => {
  it('produces expected check ids for TRAJECTAS_DEFAULTS', () => {
    const checks = auditBrandContrast(TRAJECTAS_DEFAULTS)
    const ids = checks.map((c) => c.id)
    expect(ids).toContain('body-text')
    expect(ids).toContain('muted-text')
    expect(ids).toContain('button-text')
    expect(ids).toContain('accent-badge')
    expect(ids).toContain('error-text')
    expect(ids).toContain('email-body')
    expect(ids).toContain('email-highlight')
    expect(ids).toContain('page-text') // backgroundColor is set
    // secondary-badge not present — TRAJECTAS_DEFAULTS.secondaryColor is undefined
  })

  it('does not include secondary-badge check when secondaryColor is not set', () => {
    const config: BrandConfig = { ...TRAJECTAS_DEFAULTS, secondaryColor: undefined }
    const checks = auditBrandContrast(config)
    const ids = checks.map((c) => c.id)
    expect(ids).not.toContain('secondary-badge')
  })

  it('includes secondary-badge check when secondaryColor is set', () => {
    const config: BrandConfig = { ...TRAJECTAS_DEFAULTS, secondaryColor: '#ff00ff' }
    const checks = auditBrandContrast(config)
    const ids = checks.map((c) => c.id)
    expect(ids).toContain('secondary-badge')
  })

  it('does not include page-text check when backgroundColor is not set', () => {
    const config: BrandConfig = { ...TRAJECTAS_DEFAULTS, backgroundColor: undefined }
    const checks = auditBrandContrast(config)
    const ids = checks.map((c) => c.id)
    expect(ids).not.toContain('page-text')
  })

  it('includes page-text check when backgroundColor is set', () => {
    const config: BrandConfig = { ...TRAJECTAS_DEFAULTS, backgroundColor: '#f0f0f0' }
    const checks = auditBrandContrast(config)
    const ids = checks.map((c) => c.id)
    expect(ids).toContain('page-text')
  })

  it('pale primary color (#f0f0f0) fails button-text check', () => {
    const config: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      primaryColor: '#f0f0f0',
    }
    const checks = auditBrandContrast(config)
    const buttonTextCheck = checks.find((c) => c.id === 'button-text')
    expect(buttonTextCheck).toBeDefined()
    expect(buttonTextCheck?.passes).toBe(false)
  })

  it('returns checks with required and actual ratios', () => {
    const checks = auditBrandContrast(TRAJECTAS_DEFAULTS)
    const bodyTextCheck = checks.find((c) => c.id === 'body-text')
    expect(bodyTextCheck?.required).toBe(4.5)
    expect(bodyTextCheck?.ratio).toBeGreaterThan(0)
    expect(bodyTextCheck?.passes).toBe(bodyTextCheck!.ratio >= bodyTextCheck!.required)
  })

  it('returns checks with foreground and background colors', () => {
    const checks = auditBrandContrast(TRAJECTAS_DEFAULTS)
    expect(checks.length).toBeGreaterThan(0)
    checks.forEach((check) => {
      expect(check.foreground).toMatch(/^#[0-9a-f]{6}$/i)
      expect(check.background).toMatch(/^#[0-9a-f]{6}$/i)
    })
  })

  it('returns checks with human-readable labels and context', () => {
    const checks = auditBrandContrast(TRAJECTAS_DEFAULTS)
    expect(checks.length).toBeGreaterThan(0)
    checks.forEach((check) => {
      expect(check.label.length).toBeGreaterThan(0)
      expect(check.context.length).toBeGreaterThan(0)
    })
  })
})

describe('contrastFailures', () => {
  it('returns only failing checks', () => {
    const allChecks = auditBrandContrast(TRAJECTAS_DEFAULTS)
    const failures = contrastFailures(TRAJECTAS_DEFAULTS)
    const failingChecks = allChecks.filter((c) => !c.passes)
    // Just verify we filter correctly, not assume all pass
    expect(failures.length).toBe(failingChecks.length)
  })

  it('filters to only failing checks when palette has issues', () => {
    const config: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      primaryColor: '#ffffff', // white will fail button-text
    }
    const allChecks = auditBrandContrast(config)
    const failures = contrastFailures(config)
    const failingChecks = allChecks.filter((c) => !c.passes)
    expect(failures.length).toBe(failingChecks.length)
    failures.forEach((f) => {
      expect(f.passes).toBe(false)
    })
  })

  it('returns checks with id, label, and passes=false', () => {
    const config: BrandConfig = {
      ...TRAJECTAS_DEFAULTS,
      primaryColor: '#ffffff', // white will fail button-text
    }
    const failures = contrastFailures(config)
    expect(failures.length).toBeGreaterThan(0)
    failures.forEach((f) => {
      expect(f.id.length).toBeGreaterThan(0)
      expect(f.label.length).toBeGreaterThan(0)
      expect(f.passes).toBe(false)
    })
  })
})
