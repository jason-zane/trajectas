// =============================================================================
// WCAG contrast auditing for brand configs
//
// Pure math — safe to run client-side in the editors for live warnings.
// Checks the color pairs the token pipeline actually produces (button text
// on primary, body text on surface, etc.), not just the raw config values.
//
// Results are advisory: the editors surface failures as warnings, saves are
// never blocked. A tenant is allowed to ship an ugly palette; they should
// just know they're doing it.
// =============================================================================

import type { BrandConfig } from './types'
import { DEFAULT_SEMANTIC_COLORS, DEFAULT_EMAIL_STYLES } from './defaults'
import { generateScaleHex } from './tokens'

/** WCAG 2.x relative luminance of a #RRGGBB hex color. */
export function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '')
  const channel = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
}

/** WCAG contrast ratio (1–21) between two hex colors. */
export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA)
  const lb = relativeLuminance(hexB)
  const [lighter, darker] = la >= lb ? [la, lb] : [lb, la]
  return (lighter + 0.05) / (darker + 0.05)
}

export interface ContrastCheck {
  /** Stable identifier, e.g. "button-text". */
  id: string
  /** Human label shown in the editor, e.g. "Button text on primary". */
  label: string
  /** Where this pair appears in the product. */
  context: string
  foreground: string
  background: string
  ratio: number
  /** Minimum required ratio (4.5 normal text, 3 large text/UI). */
  required: number
  passes: boolean
}

const WHITE = '#ffffff'

function check(
  id: string,
  label: string,
  context: string,
  foreground: string,
  background: string,
  required: number
): ContrastCheck {
  const ratio = contrastRatio(foreground, background)
  return {
    id,
    label,
    context,
    foreground,
    background,
    ratio: Math.round(ratio * 100) / 100,
    required,
    passes: ratio >= required,
  }
}

/**
 * Audit the color pairs a BrandConfig will actually produce.
 *
 * Derived colors (text/surface steps) are computed through the same OKLCH
 * scale used by the token pipeline, so the audit matches what renders.
 */
export function auditBrandContrast(config: BrandConfig): ContrastCheck[] {
  const primaryScale = generateScaleHex(config.primaryColor)
  const semantic = config.semanticColors ?? DEFAULT_SEMANTIC_COLORS
  const email = config.emailStyles ?? DEFAULT_EMAIL_STYLES

  const surface = primaryScale['50']
  const text = primaryScale['900']
  const textMuted = primaryScale['600']

  const checks: ContrastCheck[] = [
    check(
      'body-text',
      'Body text on surface',
      'Assessment runner text (--brand-text on --brand-surface)',
      text,
      surface,
      4.5
    ),
    check(
      'muted-text',
      'Muted text on surface',
      'Secondary text, captions, helper copy',
      textMuted,
      surface,
      4.5
    ),
    check(
      'button-text',
      'Button text on primary',
      'Primary action buttons (white label on primaryColor)',
      WHITE,
      config.primaryColor,
      4.5
    ),
    check(
      'accent-badge',
      'White text on accent',
      'Accent badges and highlights',
      WHITE,
      config.accentColor,
      3
    ),
    check(
      'error-text',
      'Error text on surface',
      'Validation and error messaging',
      semantic.destructive,
      surface,
      4.5
    ),
    check(
      'email-body',
      'Email body text',
      'Email body copy on white',
      email.textColor,
      WHITE,
      4.5
    ),
    check(
      'email-highlight',
      'Email highlight color',
      'Links and emphasis in emails on white',
      email.highlightColor,
      WHITE,
      3
    ),
  ]

  if (config.backgroundColor) {
    checks.push(
      check(
        'page-text',
        'Body text on page background',
        'Dashboard text on custom backgroundColor',
        text,
        config.backgroundColor,
        4.5
      )
    )
  }

  if (config.secondaryColor) {
    checks.push(
      check(
        'secondary-badge',
        'White text on secondary',
        'Secondary-palette buttons and badges',
        WHITE,
        config.secondaryColor,
        3
      )
    )
  }

  return checks
}

/** Convenience: only the failing checks. */
export function contrastFailures(config: BrandConfig): ContrastCheck[] {
  return auditBrandContrast(config).filter((c) => !c.passes)
}

/**
 * Audit the assessment-runner anchor pairs (THEMING.md hard rules).
 *
 * Anchors are passed in (rather than derived here) to avoid a circular
 * import with runner-tokens.ts; call with deriveRunnerAnchors(config).
 * Post-derivation these pass by construction — the audit exists to catch
 * future hand-tuned overrides and extreme brand inputs.
 */
export function auditRunnerContrast(anchors: {
  ink: string
  paper: string
  lightPage: string
  accent: string
  accentOnPaper: string
}): ContrastCheck[] {
  return [
    check(
      'runner-body',
      'Paper text on ink',
      'Runner dark-mode body text',
      anchors.paper,
      anchors.ink,
      12
    ),
    check(
      'runner-accent',
      'Accent on ink',
      'Overlines, keycaps, progress on dark surfaces',
      anchors.accent,
      anchors.ink,
      4.5
    ),
    check(
      'runner-accent-on-paper',
      'Accent-on-paper on paper',
      'Overlines and keycaps on light surfaces / selected cards',
      anchors.accentOnPaper,
      anchors.paper,
      4.5
    ),
    check(
      'runner-light-body',
      'Ink on light page',
      'Runner light-mode display text',
      anchors.ink,
      anchors.lightPage,
      12
    ),
  ]
}
