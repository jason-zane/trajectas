// =============================================================================
// Assessment-runner theme tokens
//
// The runner (dark-editorial redesign, 2026-07) is themed by FOUR anchors per
// mode — ink, paper, accent, accent-on-paper — derived mechanically from the
// brand's primaryColor/accentColor in OKLCH. Every other value is an opacity
// or lightness step of those anchors, so client re-branding is safe by
// construction: derive four values and the whole flow follows.
//
// Derivation rules follow the design handoff THEMING.md, with one deliberate
// fix: accent-on-paper is darkened until it actually passes 4.5:1 on paper
// (the handoff's hand-picked #B08D3E measured 2.72:1 against its own rule).
//
// The type stack is FIXED across brands (Source Serif 4 / Plus Jakarta Sans /
// Geist Mono) — a client brand changes the four colours; it must not change
// the system.
// =============================================================================

import type { BrandConfig, RunnerTheme } from './types'
import { hexToOklch, oklchToHex } from './tokens'
import { contrastRatio } from './contrast'

export interface RunnerAnchors {
  /** Dark brand surface (dark bg; light selected/CTA). Hex. */
  ink: string
  /** Warm off-white (dark text/selected; light bg base). Hex. */
  paper: string
  /** Light-mode page surface (paper lifted). Hex. */
  lightPage: string
  /** Light-mode panel tint (paper dropped). Hex. */
  panelTint: string
  /** Wayfinding colour on ink surfaces. Hex. */
  accent: string
  /** Accent darkened for ≥4.5:1 on paper surfaces. Hex. */
  accentOnPaper: string
}

export interface RunnerTokens {
  /** CSS custom properties string for injection via <style>. */
  css: string
  /** Individual token values for programmatic access. */
  tokens: Record<string, string>
  /** Resolved theme mode. */
  mode: RunnerTheme
  /** The four (plus derived surface) anchors, for editors/previews. */
  anchors: RunnerAnchors
}

/** rgba() string from a hex colour and alpha. */
function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Shift a hex colour's OKLCH lightness by delta (clamped 0–1). */
function shiftL(hex: string, delta: number): string {
  const o = hexToOklch(hex)
  return oklchToHex({ ...o, l: Math.max(0, Math.min(1, o.l + delta)) })
}

/**
 * Derive the four runner anchors from a brand config.
 *
 * - ink: primary hue pulled to a near-black surface (L 0.265, chroma
 *   softened — min(c×0.55, 0.045) reproduces the handoff's emerald and navy
 *   worked examples).
 * - paper: warm off-white tinted toward the ACCENT hue (empirically what the
 *   handoff's cream/ivory values are; "never pure white").
 * - accent: brand accentColor with L clamped into the 0.68–0.78 band so it
 *   reads on ink without glowing. Never the primary itself.
 * - accent-on-paper: accent darkened stepwise until ≥4.5:1 on paper.
 */
export function deriveRunnerAnchors(config: BrandConfig): RunnerAnchors {
  const primary = hexToOklch(config.primaryColor)
  const accentBase = hexToOklch(config.accentColor)

  const ink = oklchToHex({
    l: 0.265,
    c: Math.min(primary.c * 0.55, 0.045),
    h: primary.h,
  })

  const paperHue = accentBase.h
  const paper = oklchToHex({ l: 0.953, c: 0.015, h: paperHue })
  const lightPage = oklchToHex({ l: 0.966, c: 0.009, h: paperHue })
  const panelTint = oklchToHex({ l: 0.915, c: 0.02, h: paperHue })

  const accent = oklchToHex({
    l: Math.max(0.68, Math.min(0.78, accentBase.l)),
    c: accentBase.c,
    h: accentBase.h,
  })

  // Darken accent until it passes 4.5:1 on paper (keep hue/chroma — hue
  // carries the brand, lightness carries legibility).
  let onPaperL = hexToOklch(accent).l
  let accentOnPaper = accent
  while (contrastRatio(accentOnPaper, paper) < 4.5 && onPaperL > 0.3) {
    onPaperL -= 0.01
    accentOnPaper = oklchToHex({ l: onPaperL, c: accentBase.c, h: accentBase.h })
  }

  return { ink, paper, lightPage, panelTint, accent, accentOnPaper }
}

/** Fixed runner save-dot green — deliberately off-brand-accent. */
const SAVE_DOT = oklchToHex({ l: 0.72, c: 0.12, h: 160 })

/**
 * Generate the `--runner-*` CSS custom properties for the brand's resolved
 * theme mode. Token NAMES are mode-agnostic — components reference
 * `var(--runner-text)` etc. and never branch on mode themselves.
 */
export function generateRunnerTokens(config: BrandConfig): RunnerTokens {
  const mode: RunnerTheme = config.runnerTheme ?? 'dark'
  const a = deriveRunnerAnchors(config)
  const t: Record<string, string> = {}

  // Anchors (exposed raw for edge cases and previews)
  t['--runner-ink'] = a.ink
  t['--runner-paper'] = a.paper
  t['--runner-accent'] = a.accent
  t['--runner-accent-on-paper'] = a.accentOnPaper
  t['--runner-save-dot'] = SAVE_DOT
  t['--runner-progress'] = a.accent

  if (mode === 'dark') {
    // Surfaces
    t['--runner-page'] =
      `linear-gradient(170deg, ${shiftL(a.ink, 0.025)} 0%, ${a.ink} 55%, ${shiftL(a.ink, -0.02)} 100%)`
    t['--runner-page-solid'] = a.ink
    t['--runner-panel-invite'] =
      `linear-gradient(180deg, ${shiftL(a.ink, 0.005)} 0%, ${shiftL(a.ink, -0.035)} 100%)`
    t['--runner-panel-form'] =
      `linear-gradient(180deg, ${shiftL(a.ink, 0.04)} 0%, ${shiftL(a.ink, 0.005)} 100%)`

    // Text
    t['--runner-display'] = a.paper
    t['--runner-text'] = a.paper
    t['--runner-text-muted'] = rgba(a.paper, 0.6)
    t['--runner-text-faint'] = rgba(a.paper, 0.45)
    t['--runner-text-meta'] = rgba(a.paper, 0.35)
    t['--runner-placeholder'] = rgba(a.paper, 0.35)

    // Lines & ghosts
    t['--runner-hairline'] = rgba(a.paper, 0.14)
    t['--runner-ghost-border'] = rgba(a.paper, 0.16)
    t['--runner-ghost-fill'] = rgba(a.paper, 0.02)
    t['--runner-ghost-fill-hover'] = rgba(a.paper, 0.05)
    t['--runner-ghost-border-hover'] = rgba(a.paper, 0.4)

    // Inputs
    t['--runner-input-fill'] = rgba(a.paper, 0.05)
    t['--runner-input-border'] = rgba(a.paper, 0.18)
    t['--runner-input-border-focus'] = a.accent

    // CTA (accent fill, ink text)
    t['--runner-cta-fill'] = a.accent
    t['--runner-cta-text'] = a.ink
    t['--runner-cta-fill-hover'] = shiftL(a.accent, 0.04)

    // Selected answer flips to paper
    t['--runner-selected-fill'] = a.paper
    t['--runner-selected-text'] = a.ink
    t['--runner-selected-shadow'] = '0 14px 28px -12px rgba(0, 0, 0, 0.5)'

    // Wayfinding
    t['--runner-overline'] = a.accent
    t['--runner-keycap'] = a.accent
    t['--runner-keycap-selected'] = a.accentOnPaper
  } else {
    // Surfaces
    t['--runner-page'] = a.lightPage
    t['--runner-page-solid'] = a.lightPage
    t['--runner-panel-invite'] = a.panelTint
    t['--runner-panel-form'] = a.lightPage

    // Text — ink-hued neutrals, never pure black
    const paperHue = hexToOklch(a.paper).h
    t['--runner-display'] = a.ink
    t['--runner-text'] = oklchToHex({ l: 0.21, c: 0.008, h: paperHue })
    t['--runner-text-muted'] = oklchToHex({ l: 0.49, c: 0.008, h: paperHue })
    t['--runner-text-faint'] = oklchToHex({ l: 0.65, c: 0.015, h: paperHue })
    t['--runner-text-meta'] = oklchToHex({ l: 0.65, c: 0.015, h: paperHue })
    t['--runner-placeholder'] = oklchToHex({ l: 0.74, c: 0.02, h: paperHue })

    // Lines & cards (answers are white cards on paper in light mode)
    const hairline = oklchToHex({ l: 0.885, c: 0.022, h: paperHue })
    t['--runner-hairline'] = hairline
    t['--runner-ghost-border'] = hairline
    t['--runner-ghost-fill'] = '#ffffff'
    t['--runner-ghost-fill-hover'] = '#ffffff'
    t['--runner-ghost-border-hover'] = oklchToHex({ l: 0.74, c: 0.02, h: paperHue })

    // Inputs
    t['--runner-input-fill'] = '#ffffff'
    t['--runner-input-border'] = hairline
    t['--runner-input-border-focus'] = a.accentOnPaper

    // CTA (ink fill, paper text)
    t['--runner-cta-fill'] = a.ink
    t['--runner-cta-text'] = a.paper
    t['--runner-cta-fill-hover'] = shiftL(a.ink, 0.03)

    // Selected answer flips to ink
    t['--runner-selected-fill'] = a.ink
    t['--runner-selected-text'] = a.paper
    t['--runner-selected-shadow'] = `0 14px 28px -12px ${rgba(a.ink, 0.5)}`

    // Wayfinding — progress hairline keeps accent; text-level accents darken
    t['--runner-overline'] = a.accentOnPaper
    t['--runner-keycap'] = a.accentOnPaper
    t['--runner-keycap-selected'] = a.accent
  }

  const css = Object.entries(t)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')

  return { css: `:root {\n${css}\n}`, tokens: t, mode, anchors: a }
}
