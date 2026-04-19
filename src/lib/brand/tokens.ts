// =============================================================================
// Brand token generation pipeline
//
// Takes a BrandConfig and produces:
//   1. CSS custom properties (for web — OKLCH-based)
//   2. PDF style object (hex-based, for future PDF renderer)
//   3. Email inline styles (hex-based, for HTML email templates)
// =============================================================================

import type { BrandConfig, BorderRadiusPreset, NeutralTemperature } from './types'
import {
  DEFAULT_PORTAL_ACCENTS,
  DEFAULT_SEMANTIC_COLORS,
  DEFAULT_TAXONOMY_COLORS,
  DEFAULT_EMAIL_STYLES,
} from './defaults'
import { generateReportCSSTokens } from '@/lib/reports/report-tokens'
import { DEFAULT_REPORT_THEME } from '@/lib/reports/presentation'

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

/** Format OKLCH with alpha as a CSS value. */
function oklchCssAlpha(oklch: OKLCH, alpha: string): string {
  return `oklch(${oklch.l.toFixed(3)} ${oklch.c.toFixed(3)} ${oklch.h.toFixed(1)} / ${alpha})`
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

/**
 * Generate a 10-step OKLCH scale from a base color.
 *
 * Uses fixed lightness steps so that surface/text/border tokens always
 * land at predictable positions regardless of the input color's lightness.
 * Chroma and hue are inherited from the base color.
 */
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
// Portal accent token generation
// ---------------------------------------------------------------------------

/** Generate CSS vars for a portal accent color (light mode). */
function generatePortalAccentTokens(hex: string): Record<string, string> {
  const oklch = hexToOklch(hex)
  const tokens: Record<string, string> = {}

  // Adapt lightness/chroma for the target role
  const primaryL = Math.max(0.45, Math.min(0.73, oklch.l))
  const primary: OKLCH = { l: primaryL, c: Math.min(oklch.c, 0.18), h: oklch.h }

  tokens['--primary'] = oklchCss(primary)
  // White foreground if dark enough, dark foreground if light
  tokens['--primary-foreground'] = primaryL < 0.6
    ? 'oklch(0.99 0 0)'
    : `oklch(0.15 0.01 ${oklch.h.toFixed(1)})`
  tokens['--ring'] = oklchCss(primary)
  tokens['--accent'] = oklchCss({ l: 0.96, c: 0.02, h: oklch.h })
  tokens['--accent-foreground'] = oklchCss({ l: 0.45, c: 0.14, h: oklch.h })
  tokens['--sidebar-primary'] = oklchCss(primary)
  tokens['--sidebar-accent'] = 'oklch(1 0 0 / 12%)'
  tokens['--sidebar-ring'] = oklchCss(primary)
  tokens['--chart-1'] = oklchCss(primary)
  tokens['--shadow-glow'] = `0 0 20px ${oklchCssAlpha(primary, '15%')}`

  return tokens
}

// ---------------------------------------------------------------------------
// Taxonomy token generation
// ---------------------------------------------------------------------------

/** Generate bg/fg/accent CSS vars for a taxonomy level from a hex color. */
function generateTaxonomyTokens(prefix: string, hex: string): Record<string, string> {
  const oklch = hexToOklch(hex)
  const tokens: Record<string, string> = {}

  tokens[`--${prefix}-bg`] = oklchCss({ l: 0.955, c: oklch.c * 0.25, h: oklch.h })
  tokens[`--${prefix}-fg`] = oklchCss({ l: 0.38, c: oklch.c * 0.9, h: oklch.h })
  tokens[`--${prefix}-accent`] = oklchCss({ l: 0.55, c: oklch.c, h: oklch.h })

  return tokens
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
  tokens['--brand-primary'] = oklchCss(primary)
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
 * Generate FULL dashboard CSS overrides from a BrandConfig.
 *
 * This produces CSS that overrides the globals.css defaults for:
 * - Brand/sidebar colors
 * - Portal accent overrides (admin, partner, client)
 * - Semantic colors (destructive, success, warning)
 * - Taxonomy colors (dimension, competency, trait, item)
 *
 * The globals.css values remain as fallbacks — this style tag takes precedence.
 */
export function generateDashboardCSS(config: BrandConfig): string {
  const primary = hexToOklch(config.primaryColor)
  const sidebar = hexToOklch(config.sidebarColor || config.primaryColor)
  const neutralHue = NEUTRAL_HUE[config.neutralTemperature]
  const neutralChroma = NEUTRAL_CHROMA[config.neutralTemperature]

  const sections: string[] = []

  // --- :root overrides (light) ---
  const rootTokens: Record<string, string> = {}

  // Brand
  rootTokens['--brand'] = oklchCss(primary)
  rootTokens['--brand-foreground'] = 'oklch(1 0 0)'

  // Surface colors — from explicit overrides or neutral temperature
  if (config.backgroundColor) {
    const bg = hexToOklch(config.backgroundColor)
    rootTokens['--background'] = oklchCss(bg)
    rootTokens['--foreground'] = oklchCss({ l: 0.14, c: neutralChroma * 2, h: neutralHue })
  } else {
    rootTokens['--background'] = oklchCss({ l: 0.97, c: neutralChroma, h: neutralHue })
    rootTokens['--foreground'] = oklchCss({ l: 0.14, c: neutralChroma * 2, h: neutralHue })
  }

  if (config.cardColor) {
    const card = hexToOklch(config.cardColor)
    rootTokens['--card'] = oklchCss(card)
    rootTokens['--popover'] = oklchCss(card)
  } else {
    // White card with very subtle neutral tint
    rootTokens['--card'] = oklchCss({ l: 1, c: 0, h: 0 })
    rootTokens['--popover'] = oklchCss({ l: 1, c: 0, h: 0 })
  }

  rootTokens['--card-foreground'] = rootTokens['--foreground']
  rootTokens['--popover-foreground'] = rootTokens['--foreground']

  // Muted / secondary surfaces from neutral temperature
  rootTokens['--muted'] = oklchCss({ l: 0.95, c: neutralChroma, h: neutralHue })
  rootTokens['--muted-foreground'] = oklchCss({ l: 0.45, c: neutralChroma * 2, h: neutralHue })
  rootTokens['--secondary'] = oklchCss({ l: 0.95, c: neutralChroma, h: neutralHue })
  rootTokens['--secondary-foreground'] = oklchCss({ l: 0.20, c: neutralChroma * 2, h: neutralHue })
  rootTokens['--border'] = oklchCss({ l: 0.90, c: neutralChroma, h: neutralHue })
  rootTokens['--input'] = oklchCss({ l: 0.90, c: neutralChroma, h: neutralHue })

  // Sidebar from config
  rootTokens['--sidebar'] = oklchCss(sidebar)
  rootTokens['--sidebar-foreground'] = 'oklch(1 0 0 / 80%)'
  rootTokens['--sidebar-border'] = 'oklch(1 0 0 / 10%)'
  rootTokens['--sidebar-accent'] = 'oklch(1 0 0 / 12%)'
  rootTokens['--sidebar-accent-foreground'] = 'oklch(1 0 0)'

  // Glow from brand
  rootTokens['--shadow-glow'] = `0 0 20px ${oklchCssAlpha(primary, '12%')}`

  // Semantic colors
  const sem = config.semanticColors ?? DEFAULT_SEMANTIC_COLORS
  const destructive = hexToOklch(sem.destructive)
  const success = hexToOklch(sem.success)
  const warning = hexToOklch(sem.warning)
  rootTokens['--destructive'] = oklchCss(destructive)
  rootTokens['--success'] = oklchCss(success)
  rootTokens['--warning'] = oklchCss(warning)

  // Taxonomy colors
  const tax = config.taxonomyColors ?? DEFAULT_TAXONOMY_COLORS
  Object.assign(rootTokens, generateTaxonomyTokens('dimension', tax.dimension))
  Object.assign(rootTokens, generateTaxonomyTokens('competency', tax.competency))
  Object.assign(rootTokens, generateTaxonomyTokens('trait', tax.trait))
  Object.assign(rootTokens, generateTaxonomyTokens('item', tax.item))

  const rootCss = Object.entries(rootTokens)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')
  sections.push(`:root {\n${rootCss}\n}`)

  // --- Portal accent overrides ---
  const portals = config.portalAccents ?? DEFAULT_PORTAL_ACCENTS

  const adminLight = generatePortalAccentTokens(portals.admin)
  const adminRootCss = Object.entries(adminLight)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')
  sections.push(`:root {\n${adminRootCss}\n}`)

  const partnerLight = generatePortalAccentTokens(portals.partner)
  const partnerLightCss = Object.entries(partnerLight)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')
  sections.push(`[data-portal="partner"] {\n${partnerLightCss}\n}`)

  const clientLight = generatePortalAccentTokens(portals.client)
  const clientLightCss = Object.entries(clientLight)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')
  sections.push(`[data-portal="client"] {\n${clientLightCss}\n}`)

  // --- Report theme ---
  const reportTheme = config.reportTheme ?? DEFAULT_REPORT_THEME
  const reportCss = generateReportCSSTokens(reportTheme)
  sections.push(`:root {\n${reportCss}\n}`)

  return sections.join('\n\n')
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

  const emailOverrides = config.emailStyles ?? DEFAULT_EMAIL_STYLES

  const colors = {
    primary: config.primaryColor,
    primaryDark: oklchToHex(scale['800']),
    primaryLight: oklchToHex(scale['100']),
    text: emailOverrides.textColor,
    textMuted: emailOverrides.footerTextColor,
    background: oklchToHex(scale['50']),
    border: oklchToHex(scale['200']),
  }

  const safeHeadingFont = sanitiseCSSValue(config.headingFont)
  const safeBodyFont = sanitiseCSSValue(config.bodyFont)

  return {
    header: `background-color: ${config.primaryColor}; color: #ffffff; padding: 24px 32px; font-family: ${safeHeadingFont}, system-ui, sans-serif;`,
    body: `background-color: #ffffff; color: ${colors.text}; padding: 32px; font-family: ${safeBodyFont}, system-ui, sans-serif; font-size: 15px; line-height: 1.6;`,
    button: `display: inline-block; background-color: ${config.primaryColor}; color: #ffffff; padding: 12px 28px; border-radius: ${RADIUS_BASE[config.borderRadius]}px; text-decoration: none; font-weight: 500; font-family: ${safeBodyFont}, system-ui, sans-serif;`,
    footer: `border-top: 1px solid ${colors.border}; padding: 16px 32px; color: ${colors.textMuted}; font-size: 13px; text-align: center; font-family: ${safeBodyFont}, system-ui, sans-serif;`,
    colors,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip characters that could break out of a CSS value context.
 * Prevents injection of `</style>`, `<script>`, or CSS rule-breaking characters.
 */
function sanitiseCSSValue(value: string): string {
  return value.replace(/[<>{}();\\"/]/g, '')
}

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
  return FONT_FAMILIES[fontName] ?? `"${sanitiseCSSValue(fontName)}", system-ui, sans-serif`
}
