// =============================================================================
// Brand token generation pipeline
//
// Takes a BrandConfig and produces:
//   1. CSS custom properties (for web — OKLCH-based)
//   2. PDF style object (hex-based, for future PDF renderer)
//   3. Email inline styles (hex-based, for HTML email templates)
// =============================================================================

import type { BrandConfig, BorderRadiusPreset, NeutralTemperature } from './types'

// ---------------------------------------------------------------------------
// Color math — hex ↔ OKLCH conversion
// ---------------------------------------------------------------------------

interface OKLCH {
  l: number // lightness 0–1
  c: number // chroma 0–0.4
  h: number // hue 0–360
}

interface RGB {
  r: number // 0–1
  g: number // 0–1
  b: number // 0–1
}

/** Parse a hex color string (#RRGGBB) to normalized RGB. */
function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  }
}

/** Convert normalized RGB to hex string. */
function rgbToHex(rgb: RGB): string {
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  const toHex = (v: number) =>
    Math.round(clamp(v) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`
}

/** sRGB gamma → linear. */
function linearize(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** Linear → sRGB gamma. */
function delinearize(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

/** Convert linear RGB to OKLab. */
function linearRgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ]
}

/** Convert OKLab to linear RGB. */
function oklabToLinearRgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

/** Convert hex color to OKLCH. */
export function hexToOklch(hex: string): OKLCH {
  const { r, g, b } = hexToRgb(hex)
  const [L, a, bVal] = linearRgbToOklab(linearize(r), linearize(g), linearize(b))
  const c = Math.sqrt(a * a + bVal * bVal)
  let h = (Math.atan2(bVal, a) * 180) / Math.PI
  if (h < 0) h += 360
  return { l: L, c, h }
}

/** Convert OKLCH to hex color. */
export function oklchToHex(oklch: OKLCH): string {
  const a = oklch.c * Math.cos((oklch.h * Math.PI) / 180)
  const b = oklch.c * Math.sin((oklch.h * Math.PI) / 180)
  const [lr, lg, lb] = oklabToLinearRgb(oklch.l, a, b)
  return rgbToHex({ r: delinearize(lr), g: delinearize(lg), b: delinearize(lb) })
}

/** Format OKLCH as a CSS value. */
function oklchCss(oklch: OKLCH): string {
  return `oklch(${oklch.l.toFixed(3)} ${oklch.c.toFixed(3)} ${oklch.h.toFixed(1)})`
}

// ---------------------------------------------------------------------------
// Scale generation
// ---------------------------------------------------------------------------

/**
 * Lightness steps for a 10-step brand scale.
 * Maps step name → target lightness (0–1).
 * Chroma is scaled proportionally to avoid over-saturation at extremes.
 */
const SCALE_STEPS: Record<string, { l: number; chromaScale: number }> = {
  '50': { l: 0.97, chromaScale: 0.25 },
  '100': { l: 0.93, chromaScale: 0.35 },
  '200': { l: 0.88, chromaScale: 0.5 },
  '300': { l: 0.80, chromaScale: 0.65 },
  '400': { l: 0.70, chromaScale: 0.85 },
  '500': { l: 0.60, chromaScale: 1.0 },
  '600': { l: 0.52, chromaScale: 1.0 },
  '700': { l: 0.44, chromaScale: 0.95 },
  '800': { l: 0.35, chromaScale: 0.85 },
  '900': { l: 0.25, chromaScale: 0.7 },
}

/** Generate a 10-step OKLCH scale from a base color. */
function generateScale(base: OKLCH): Record<string, OKLCH> {
  const scale: Record<string, OKLCH> = {}
  for (const [step, { l, chromaScale }] of Object.entries(SCALE_STEPS)) {
    scale[step] = { l, c: base.c * chromaScale, h: base.h }
  }
  return scale
}

// ---------------------------------------------------------------------------
// Neutral temperature → hue offset
// ---------------------------------------------------------------------------

const NEUTRAL_HUE: Record<NeutralTemperature, number> = {
  warm: 70, // amber-ish
  neutral: 260, // very slight blue (achromatic)
  cool: 240, // blue-ish
}

const NEUTRAL_CHROMA: Record<NeutralTemperature, number> = {
  warm: 0.01,
  neutral: 0.005,
  cool: 0.01,
}

// ---------------------------------------------------------------------------
// Border radius presets
// ---------------------------------------------------------------------------

const RADIUS_BASE: Record<BorderRadiusPreset, number> = {
  sharp: 4,
  soft: 8,
  round: 16,
}

// ---------------------------------------------------------------------------
// CSS Token Generation
// ---------------------------------------------------------------------------

export interface CSSTokens {
  /** CSS custom properties as a single string (for injection via <style>). */
  css: string
  /** Individual token values for programmatic access. */
  tokens: Record<string, string>
}

/**
 * Generate CSS custom properties from a BrandConfig.
 *
 * Produces:
 * - `--brand-50` through `--brand-900` (10-step primary scale)
 * - `--brand-accent-50` through `--brand-accent-900` (10-step accent scale)
 * - `--brand-surface`, `--brand-text`, `--brand-border` (semantic tokens)
 * - `--brand-radius` (border radius base)
 * - `--brand-font-heading`, `--brand-font-body`, `--brand-font-mono`
 */
export function generateCSSTokens(config: BrandConfig): CSSTokens {
  const primary = hexToOklch(config.primaryColor)
  const accent = hexToOklch(config.accentColor)
  const primaryScale = generateScale(primary)
  const accentScale = generateScale(accent)

  const neutralHue = NEUTRAL_HUE[config.neutralTemperature]
  const neutralChroma = NEUTRAL_CHROMA[config.neutralTemperature]
  const radiusBase = RADIUS_BASE[config.borderRadius]

  const tokens: Record<string, string> = {}

  // Primary scale
  for (const [step, oklch] of Object.entries(primaryScale)) {
    tokens[`--brand-${step}`] = oklchCss(oklch)
  }

  // Accent scale
  for (const [step, oklch] of Object.entries(accentScale)) {
    tokens[`--brand-accent-${step}`] = oklchCss(oklch)
  }

  // Semantic tokens (light mode)
  tokens['--brand-surface'] = oklchCss(primaryScale['50'])
  tokens['--brand-surface-raised'] = oklchCss(primaryScale['100'])
  tokens['--brand-text'] = oklchCss(primaryScale['900'])
  tokens['--brand-text-muted'] = oklchCss(primaryScale['600'])
  tokens['--brand-border'] = oklchCss(primaryScale['200'])
  tokens['--brand-ring'] = oklchCss(primaryScale['500'])
  tokens['--brand-primary'] = oklchCss(primaryScale['600'])
  tokens['--brand-primary-foreground'] = oklchCss({ l: 0.99, c: 0, h: 0 })

  // Neutral tokens
  tokens['--brand-neutral-50'] = oklchCss({ l: 0.97, c: neutralChroma, h: neutralHue })
  tokens['--brand-neutral-100'] = oklchCss({ l: 0.93, c: neutralChroma, h: neutralHue })
  tokens['--brand-neutral-200'] = oklchCss({ l: 0.88, c: neutralChroma, h: neutralHue })
  tokens['--brand-neutral-300'] = oklchCss({ l: 0.80, c: neutralChroma, h: neutralHue })
  tokens['--brand-neutral-400'] = oklchCss({ l: 0.65, c: neutralChroma, h: neutralHue })
  tokens['--brand-neutral-500'] = oklchCss({ l: 0.50, c: neutralChroma, h: neutralHue })
  tokens['--brand-neutral-600'] = oklchCss({ l: 0.40, c: neutralChroma, h: neutralHue })
  tokens['--brand-neutral-700'] = oklchCss({ l: 0.30, c: neutralChroma, h: neutralHue })
  tokens['--brand-neutral-800'] = oklchCss({ l: 0.20, c: neutralChroma, h: neutralHue })
  tokens['--brand-neutral-900'] = oklchCss({ l: 0.13, c: neutralChroma, h: neutralHue })

  // Shape
  tokens['--brand-radius'] = `${radiusBase}px`
  tokens['--brand-radius-sm'] = `${Math.round(radiusBase * 0.5)}px`
  tokens['--brand-radius-md'] = `${Math.round(radiusBase * 0.75)}px`
  tokens['--brand-radius-lg'] = `${radiusBase}px`
  tokens['--brand-radius-xl'] = `${Math.round(radiusBase * 1.5)}px`
  tokens['--brand-radius-2xl'] = `${Math.round(radiusBase * 2)}px`

  // Typography
  tokens['--brand-font-heading'] = getFontFamily(config.headingFont)
  tokens['--brand-font-body'] = getFontFamily(config.bodyFont)
  tokens['--brand-font-mono'] = getFontFamily(config.monoFont)

  // Build CSS string
  const css = Object.entries(tokens)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')

  return { css: `:root {\n${css}\n}`, tokens }
}

/**
 * Generate dark-mode CSS token overrides.
 * In dark mode, the scale is inverted: 50 becomes the darkest surface,
 * 900 becomes the lightest text color.
 */
export function generateDarkCSSTokens(config: BrandConfig): string {
  const primary = hexToOklch(config.primaryColor)
  const primaryScale = generateScale(primary)

  const neutralHue = NEUTRAL_HUE[config.neutralTemperature]
  const neutralChroma = NEUTRAL_CHROMA[config.neutralTemperature]

  const tokens: Record<string, string> = {}

  // Semantic tokens (dark mode — inverted)
  tokens['--brand-surface'] = oklchCss({ l: 0.13, c: neutralChroma * 2, h: primary.h })
  tokens['--brand-surface-raised'] = oklchCss({ l: 0.17, c: neutralChroma * 2, h: primary.h })
  tokens['--brand-text'] = oklchCss(primaryScale['100'])
  tokens['--brand-text-muted'] = oklchCss(primaryScale['400'])
  tokens['--brand-border'] = oklchCss({ l: 0.22, c: neutralChroma * 3, h: primary.h })
  tokens['--brand-ring'] = oklchCss(primaryScale['400'])
  tokens['--brand-primary'] = oklchCss(primaryScale['400'])
  tokens['--brand-primary-foreground'] = oklchCss(primaryScale['900'])

  // Dark neutral overrides
  tokens['--brand-neutral-50'] = oklchCss({ l: 0.13, c: neutralChroma, h: neutralHue })
  tokens['--brand-neutral-100'] = oklchCss({ l: 0.17, c: neutralChroma, h: neutralHue })
  tokens['--brand-neutral-200'] = oklchCss({ l: 0.22, c: neutralChroma, h: neutralHue })
  tokens['--brand-neutral-300'] = oklchCss({ l: 0.30, c: neutralChroma, h: neutralHue })
  tokens['--brand-neutral-400'] = oklchCss({ l: 0.45, c: neutralChroma, h: neutralHue })
  tokens['--brand-neutral-500'] = oklchCss({ l: 0.55, c: neutralChroma, h: neutralHue })
  tokens['--brand-neutral-600'] = oklchCss({ l: 0.65, c: neutralChroma, h: neutralHue })
  tokens['--brand-neutral-700'] = oklchCss({ l: 0.75, c: neutralChroma, h: neutralHue })
  tokens['--brand-neutral-800'] = oklchCss({ l: 0.85, c: neutralChroma, h: neutralHue })
  tokens['--brand-neutral-900'] = oklchCss({ l: 0.93, c: neutralChroma, h: neutralHue })

  const css = Object.entries(tokens)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')

  return `.dark {\n${css}\n}`
}

// ---------------------------------------------------------------------------
// PDF Style Generation
// ---------------------------------------------------------------------------

export interface PDFStyles {
  /** Hex colors for PDF renderer. */
  colors: {
    primary: string
    primaryLight: string
    primaryDark: string
    accent: string
    accentLight: string
    text: string
    textMuted: string
    surface: string
    border: string
  }
  /** Font family names. */
  fonts: {
    heading: string
    body: string
    mono: string
  }
  /** Border radius in px. */
  borderRadius: number
}

/** Generate styles suitable for a PDF renderer (hex-based). */
export function generatePDFStyles(config: BrandConfig): PDFStyles {
  const primary = hexToOklch(config.primaryColor)
  const accent = hexToOklch(config.accentColor)
  const scale = generateScale(primary)
  const accentScale = generateScale(accent)

  return {
    colors: {
      primary: config.primaryColor,
      primaryLight: oklchToHex(scale['100']),
      primaryDark: oklchToHex(scale['800']),
      accent: config.accentColor,
      accentLight: oklchToHex(accentScale['100']),
      text: oklchToHex(scale['900']),
      textMuted: oklchToHex(scale['600']),
      surface: oklchToHex(scale['50']),
      border: oklchToHex(scale['200']),
    },
    fonts: {
      heading: config.headingFont,
      body: config.bodyFont,
      mono: config.monoFont,
    },
    borderRadius: RADIUS_BASE[config.borderRadius],
  }
}

// ---------------------------------------------------------------------------
// Email Inline Style Generation
// ---------------------------------------------------------------------------

export interface EmailStyles {
  /** Inline style strings keyed by component. */
  header: string
  body: string
  button: string
  footer: string
  /** Individual hex values for template composition. */
  colors: {
    primary: string
    primaryDark: string
    primaryLight: string
    text: string
    textMuted: string
    background: string
    border: string
  }
}

/** Generate inline CSS styles for HTML email templates. */
export function generateEmailStyles(config: BrandConfig): EmailStyles {
  const primary = hexToOklch(config.primaryColor)
  const scale = generateScale(primary)

  const colors = {
    primary: config.primaryColor,
    primaryDark: oklchToHex(scale['800']),
    primaryLight: oklchToHex(scale['100']),
    text: oklchToHex(scale['900']),
    textMuted: oklchToHex(scale['600']),
    background: oklchToHex(scale['50']),
    border: oklchToHex(scale['200']),
  }

  return {
    header: `background-color: ${colors.primary}; color: #ffffff; padding: 24px 32px; font-family: ${config.headingFont}, system-ui, sans-serif;`,
    body: `background-color: #ffffff; color: ${colors.text}; padding: 32px; font-family: ${config.bodyFont}, system-ui, sans-serif; font-size: 15px; line-height: 1.6;`,
    button: `display: inline-block; background-color: ${colors.primary}; color: #ffffff; padding: 12px 28px; border-radius: ${RADIUS_BASE[config.borderRadius]}px; text-decoration: none; font-weight: 500; font-family: ${config.bodyFont}, system-ui, sans-serif;`,
    footer: `border-top: 1px solid ${colors.border}; padding: 16px 32px; color: ${colors.textMuted}; font-size: 13px; text-align: center; font-family: ${config.bodyFont}, system-ui, sans-serif;`,
    colors,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get CSS font-family string for a font name. */
function getFontFamily(fontName: string): string {
  // Import here would create circular dependency, so use a simple lookup
  const FONT_FAMILIES: Record<string, string> = {
    'Plus Jakarta Sans': '"Plus Jakarta Sans", system-ui, sans-serif',
    'Inter': '"Inter", system-ui, sans-serif',
    'DM Sans': '"DM Sans", system-ui, sans-serif',
    'Sora': '"Sora", system-ui, sans-serif',
    'Outfit': '"Outfit", system-ui, sans-serif',
    'Manrope': '"Manrope", system-ui, sans-serif',
    'Source Sans 3': '"Source Sans 3", system-ui, sans-serif',
    'Geist Mono': '"Geist Mono", ui-monospace, monospace',
    'JetBrains Mono': '"JetBrains Mono", ui-monospace, monospace',
    'Fira Code': '"Fira Code", ui-monospace, monospace',
  }
  return FONT_FAMILIES[fontName] ?? `"${fontName}", system-ui, sans-serif`
}
