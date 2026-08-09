import { describe, expect, it } from 'vitest'

import {
  resolveSurfaceRoles,
  generateCSSTokens,
  generatePDFStyles,
  generateEmailStyles,
  hexToOklch,
  oklchToHex,
} from '@/lib/brand/tokens'
import { deriveRunnerAnchors } from '@/lib/brand/runner-tokens'
import { auditRunnerContrast, contrastRatio } from '@/lib/brand/contrast'
import { TRAJECTAS_DEFAULTS } from '@/lib/brand/defaults'
import type { BrandConfig } from '@/lib/brand/types'

/** Executive Performance Partners: saturated orange primary, dark green accent. */
const ORANGE_BRAND: BrandConfig = {
  ...TRAJECTAS_DEFAULTS,
  primaryColor: '#f07d00',
  accentColor: '#1e3a32',
}

/**
 * Chroma above which a colour stops reading as a neutral and starts reading
 * as "a tinted surface". The old primary-derived roles hit 0.12.
 */
const NEUTRAL_CHROMA_LIMIT = 0.02

describe('resolveSurfaceRoles', () => {
  it('keeps every role near-achromatic for a saturated primary', () => {
    const roles = resolveSurfaceRoles(ORANGE_BRAND)

    for (const [role, hex] of Object.entries(roles)) {
      const { c } = hexToOklch(hex)
      expect(c, `${role} (${hex}) should read as a neutral`).toBeLessThanOrEqual(
        NEUTRAL_CHROMA_LIMIT
      )
    }
  })

  it('is independent of primaryColor', () => {
    const orange = resolveSurfaceRoles(ORANGE_BRAND)
    const green = resolveSurfaceRoles({
      ...ORANGE_BRAND,
      primaryColor: '#2d6a5a',
    })

    expect(orange).toEqual(green)
  })

  it('follows neutralTemperature', () => {
    const warm = resolveSurfaceRoles({
      ...ORANGE_BRAND,
      neutralTemperature: 'warm',
    })
    const cool = resolveSurfaceRoles({
      ...ORANGE_BRAND,
      neutralTemperature: 'cool',
    })

    expect(hexToOklch(warm.surface).h).not.toBeCloseTo(
      hexToOklch(cool.surface).h,
      0
    )
  })

  it('keeps body text legible on surface', () => {
    for (const temperature of ['warm', 'neutral', 'cool'] as const) {
      const roles = resolveSurfaceRoles({
        ...ORANGE_BRAND,
        neutralTemperature: temperature,
      })
      expect(contrastRatio(roles.text, roles.surface)).toBeGreaterThanOrEqual(4.5)
      expect(
        contrastRatio(roles.textMuted, roles.surface)
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('honours pinned roles and leaves the rest derived', () => {
    const derived = resolveSurfaceRoles(ORANGE_BRAND)
    const pinned = resolveSurfaceRoles({
      ...ORANGE_BRAND,
      surfaceColors: { text: '#123456' },
    })

    expect(pinned.text).toBe('#123456')
    expect(pinned.surface).toBe(derived.surface)
    expect(pinned.border).toBe(derived.border)
  })
})

describe('neutral roles flow through every renderer', () => {
  const config: BrandConfig = {
    ...ORANGE_BRAND,
    surfaceColors: { surface: '#fafafa', text: '#111111', border: '#dddddd' },
  }

  it('reaches the CSS tokens', () => {
    const { tokens } = generateCSSTokens(config)
    expect(tokens['--brand-surface']).toBe('#fafafa')
    expect(tokens['--brand-text']).toBe('#111111')
    expect(tokens['--brand-border']).toBe('#dddddd')
  })

  it('reaches the PDF styles', () => {
    const { colors } = generatePDFStyles(config)
    expect(colors.surface).toBe('#fafafa')
    expect(colors.text).toBe('#111111')
    expect(colors.border).toBe('#dddddd')
  })

  it('reaches the email styles', () => {
    const { colors } = generateEmailStyles(config)
    expect(colors.background).toBe('#fafafa')
    expect(colors.border).toBe('#dddddd')
  })
})

describe('deriveRunnerAnchors', () => {
  it('does not turn an orange primary into brown ink', () => {
    const { ink } = deriveRunnerAnchors(ORANGE_BRAND)
    // Brown is orange at low lightness — the give-away is chroma, not hue.
    // The old flat 0.045 ceiling gave #361f0e (chocolate); the hue-aware one
    // gives a warm charcoal.
    expect(hexToOklch(ink).c).toBeLessThanOrEqual(0.018)
  })

  it('leaves ink outside the amber band untouched', () => {
    // Emerald (hue ~174) is well clear of the mud band: the ceiling must not
    // bite, or every existing tenant's runner shifts.
    const emerald = deriveRunnerAnchors(TRAJECTAS_DEFAULTS)
    expect(emerald.ink).toBe('#0e2b24')
  })

  it('restores chroma when a dark accent is lifted to anchor lightness', () => {
    // #1e3a32 is L 0.32; lifting it to 0.68 at its original chroma yields a
    // grey-sage. The accent should still read as green.
    const { accent } = deriveRunnerAnchors(ORANGE_BRAND)
    expect(hexToOklch(accent).c).toBeGreaterThan(hexToOklch('#1e3a32').c)
  })

  it('leaves an already-saturated accent exactly as before', () => {
    // Chroma restoration must be a no-op when there is nothing to restore,
    // or every existing tenant's accent shifts. Compare against the
    // pre-fix formula: lift lightness, keep chroma untouched.
    const violet = '#6d28d9'
    const { l, c, h } = hexToOklch(violet)
    const withoutRestoration = oklchToHex({
      l: Math.max(0.68, Math.min(0.78, l)),
      c,
      h,
    })

    const { accent } = deriveRunnerAnchors({
      ...TRAJECTAS_DEFAULTS,
      accentColor: violet,
    })
    expect(accent).toBe(withoutRestoration)
  })

  it('passes every runner contrast rule across a spread of brands', () => {
    const brands: [string, string][] = [
      ['#2d6a5a', '#a78d52'],
      ['#f07d00', '#1e3a32'],
      ['#c0392b', '#2980b9'],
      ['#1b2a6b', '#e67e22'],
      ['#d4a032', '#6d28d9'],
      ['#7a4a25', '#c9a962'],
    ]

    for (const [primaryColor, accentColor] of brands) {
      const anchors = deriveRunnerAnchors({
        ...TRAJECTAS_DEFAULTS,
        primaryColor,
        accentColor,
      })
      for (const check of auditRunnerContrast(anchors)) {
        expect(
          check.passes,
          `${primaryColor}/${accentColor}: ${check.label} was ${check.ratio}:1, needs ${check.required}:1`
        ).toBe(true)
      }
    }
  })

  it('honours pinned anchors', () => {
    const anchors = deriveRunnerAnchors({
      ...ORANGE_BRAND,
      runnerAnchors: { ink: '#101010', accent: '#ff0000' },
    })
    expect(anchors.ink).toBe('#101010')
    expect(anchors.accent).toBe('#ff0000')
  })

  it('derives accent-on-paper from a pinned accent', () => {
    const anchors = deriveRunnerAnchors({
      ...ORANGE_BRAND,
      runnerAnchors: { accent: '#8fd6bd' },
    })
    // Pinned accent is far too light for paper; the derived companion must
    // still clear the legibility bar.
    expect(anchors.accentOnPaper).not.toBe('#8fd6bd')
    expect(
      contrastRatio(anchors.accentOnPaper, anchors.paper)
    ).toBeGreaterThanOrEqual(4.5)
  })

  it('carries the light theme with a pinned paper', () => {
    const anchors = deriveRunnerAnchors({
      ...ORANGE_BRAND,
      runnerAnchors: { paper: '#f5efe6' },
    })
    // lightPage and panelTint are paper lifted/dropped — they must track the
    // pinned hue, not the accent's. Tolerance is generous because hue is
    // numerically twitchy at the near-zero chroma these surfaces carry.
    const paperHue = hexToOklch('#f5efe6').h
    const accentHue = hexToOklch(ORANGE_BRAND.accentColor).h

    for (const surface of [anchors.lightPage, anchors.panelTint]) {
      const hue = hexToOklch(surface).h
      expect(Math.abs(hue - paperHue)).toBeLessThan(5)
      expect(Math.abs(hue - accentHue)).toBeGreaterThan(50)
    }
  })

  it('takes a pinned accent-on-paper verbatim, even a bad one', () => {
    // Pinning is an explicit override; the editor warns via auditRunnerContrast
    // rather than silently correcting the value.
    const anchors = deriveRunnerAnchors({
      ...ORANGE_BRAND,
      runnerAnchors: { accentOnPaper: '#fefefe' },
    })
    expect(anchors.accentOnPaper).toBe('#fefefe')
    const failing = auditRunnerContrast(anchors).filter((c) => !c.passes)
    expect(failing.map((c) => c.id)).toContain('runner-accent-on-paper')
  })
})
