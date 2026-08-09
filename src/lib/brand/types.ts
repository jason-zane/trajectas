// =============================================================================
// Brand configuration types
// =============================================================================

import type { ReportTheme } from '@/lib/reports/presentation'

/** Neutral tone temperature — controls the hue tint of all gray/neutral tones. */
export type NeutralTemperature = 'warm' | 'neutral' | 'cool'

/** Border radius preset. */
export type BorderRadiusPreset = 'sharp' | 'soft' | 'round'

/** Who owns a brand config. */
export type BrandOwnerType = 'platform' | 'partner' | 'client' | 'campaign'

/** Portal accent colors — one hex per portal context. */
export interface PortalAccents {
  /** Admin portal accent (default: violet #6d28d9). */
  admin: string
  /** Partner portal accent (default: gold #d4a032). */
  partner: string
  /** Client portal accent (default: terracotta #b85c3a). */
  client: string
}

/**
 * Explicit overrides for the neutral-role tokens (`--brand-surface`,
 * `--brand-text`, `--brand-border`, …).
 *
 * These roles are normally derived from `neutralTemperature` at fixed role
 * lightnesses — see `resolveSurfaceRoles` in tokens.ts. Set a field here to
 * pin it to an exact colour instead. Every field is optional; unset fields
 * keep the derived value.
 *
 * The same five roles drive the web tokens, the PDF renderer and the email
 * frame, so an override here follows the brand across all three.
 */
export interface SurfaceRoleColors {
  /** `--brand-surface` — the base branded surface. */
  surface?: string
  /** `--brand-surface-raised` — cards and raised panels. */
  surfaceRaised?: string
  /** `--brand-text` — body copy. */
  text?: string
  /** `--brand-text-muted` — secondary copy, captions, helper text. */
  textMuted?: string
  /** `--brand-border` — hairlines and dividers. */
  border?: string
}

/**
 * Explicit overrides for the four assessment-runner anchors.
 *
 * Anchors are normally derived from `primaryColor`/`accentColor` — see
 * `deriveRunnerAnchors` in runner-tokens.ts. Set a field here to pin it.
 * `accentOnPaper` still auto-darkens from the resolved `accent` for
 * legibility unless it too is set explicitly.
 */
export interface RunnerAnchorOverrides {
  /** Dark brand surface — the runner page background in dark mode. */
  ink?: string
  /** Warm off-white — runner text in dark mode, page base in light mode. */
  paper?: string
  /** Wayfinding colour on ink surfaces (overlines, keycaps, CTA fill). */
  accent?: string
  /** Accent variant used on paper surfaces; must clear 4.5:1 on paper. */
  accentOnPaper?: string
}

/** Semantic status colors. */
export interface SemanticColors {
  destructive: string
  success: string
  warning: string
}

/** Taxonomy level identity colors. */
export interface TaxonomyColors {
  dimension: string
  competency: string
  trait: string
  item: string
}

/** Email template style overrides. */
export interface EmailStyleColors {
  /** Body text color (default: near-black). */
  textColor: string
  /** Highlight/bold color (default: brand primary). */
  highlightColor: string
  /** Footer text color (default: muted gray). */
  footerTextColor: string
}

/** Spacing density preset — scales the `--brand-space-*` token ramp. */
export type SpacingDensity = 'compact' | 'comfortable' | 'spacious'

/** Type scale preset — controls the size ramp of `--brand-text-*` tokens. */
export type TypeScalePreset = 'compact' | 'default' | 'generous'

/** Named typographic levels emitted as `--brand-text-<level>-*` tokens. */
export type TypeLevelName = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'label' | 'caption'

/** Concrete style of a single typographic level. */
export interface TypeLevelStyle {
  /** CSS font-size (e.g., "2.25rem"). */
  size: string
  /** Font weight (300–800). */
  weight: number
  /** Unitless line-height. */
  lineHeight: number
  /** CSS letter-spacing (e.g., "-0.01em"). */
  letterSpacing: string
}

/**
 * Typography settings beyond font family.
 *
 * The `scale` preset drives the full level ramp; `headingWeight` / `bodyWeight`
 * adjust weights across the ramp; `levels` allows advanced per-level overrides
 * (applied last, no editor UI yet — reserved for power users / future editor).
 */
export interface TypographySettings {
  scale?: TypeScalePreset
  /** Weight applied to display/h1/h2/h3 (default 600). */
  headingWeight?: number
  /** Weight applied to body/caption (default 400); label gets +100. */
  bodyWeight?: number
  levels?: Partial<Record<TypeLevelName, Partial<TypeLevelStyle>>>
}

/** Button treatment tokens (`--brand-button-*`). */
export interface ButtonStyle {
  /**
   * Corner treatment: `inherit` follows the borderRadius preset,
   * `pill` is fully rounded, `sharp` is near-square.
   */
  shape?: 'inherit' | 'pill' | 'sharp'
  /** Button label font weight (default 500). */
  weight?: number
  /** Button label case treatment (default 'none'). */
  textTransform?: 'none' | 'uppercase'
}

/** Optional gradient accent (`--brand-gradient`), defaults primary → accent. */
export interface GradientAccent {
  enabled: boolean
  /** Gradient angle in degrees (default 135). */
  angle?: number
  /** Start color hex (default: primaryColor). */
  from?: string
  /** End color hex (default: accentColor). */
  to?: string
}

/**
 * Assessment-runner theme mode. `dark` is the Trajectas default (ink
 * surfaces, paper text); `light` inverts to paper surfaces with ink
 * accents. Both derive from the same four anchors (ink / paper / accent /
 * accent-on-paper) — see generateRunnerTokens in tokens.ts.
 */
export type RunnerTheme = 'dark' | 'light'

/**
 * Complete brand configuration. Stored as JSONB in the `brand_configs` table.
 *
 * Colors are stored as hex strings. The token pipeline converts to OKLCH
 * internally to generate perceptually uniform 10-step scales.
 */
export interface BrandConfig {
  /** Display name (e.g., "Trajectas" or org name). */
  name: string

  /** Full horizontal logo URL. */
  logoUrl?: string

  /** Square logomark URL. */
  logomarkUrl?: string

  // -- Color ----------------------------------------------------------------

  /** Primary brand color as hex (e.g., "#2d6a5a"). */
  primaryColor: string

  /** Accent color as hex (e.g., "#c9a962"). Used for premium moments. */
  accentColor: string

  /**
   * Optional secondary palette color as hex. When set, a full
   * `--brand-secondary-50…900` scale is emitted alongside primary/accent.
   */
  secondaryColor?: string

  /**
   * Controls the hue tint of neutral tones (backgrounds, borders, muted text).
   * - `warm` shifts neutrals toward amber
   * - `cool` shifts neutrals toward blue
   * - `neutral` keeps neutrals achromatic
   *
   * Drives both the `--brand-neutral-*` ramp and the neutral-role tokens
   * (`--brand-surface`, `--brand-text`, `--brand-border`, …). Chroma is held
   * low by construction, so no primary colour can push these toward mud.
   */
  neutralTemperature: NeutralTemperature

  /** Pin individual neutral-role colours instead of deriving them. */
  surfaceColors?: SurfaceRoleColors

  /** Per-portal accent hex colors. */
  portalAccents?: PortalAccents

  /** Sidebar background color as hex. Defaults to primary. */
  sidebarColor?: string

  /** Page background color as hex. Overrides neutral temperature for the main surface. */
  backgroundColor?: string

  /** Card / popover background color as hex. */
  cardColor?: string

  /** Semantic status colors. */
  semanticColors?: SemanticColors

  /** Taxonomy level identity colors. */
  taxonomyColors?: TaxonomyColors

  /** Email template style overrides. */
  emailStyles?: EmailStyleColors

  /** Report rendering theme colors. */
  reportTheme?: ReportTheme

  // -- Typography -----------------------------------------------------------

  /** Font family for headings. Must be from the curated font list. */
  headingFont: string

  /** Font family for body text. Must be from the curated font list. */
  bodyFont: string

  /** Font family for monospace/code contexts. */
  monoFont: string

  /** Type scale, weights, and per-level overrides. */
  typography?: TypographySettings

  // -- Shape & density --------------------------------------------------------

  /**
   * Border radius preset.
   * - `sharp` → 4px base
   * - `soft`  → 8px base  (default)
   * - `round` → 16px base
   */
  borderRadius: BorderRadiusPreset

  /** Spacing density preset — scales the `--brand-space-*` ramp. */
  spacingDensity?: SpacingDensity

  /** Button treatment. */
  buttonStyle?: ButtonStyle

  /** Optional gradient accent. */
  gradientAccent?: GradientAccent

  /** Assessment-runner theme mode (default `dark`). */
  runnerTheme?: RunnerTheme

  /** Pin individual runner anchors instead of deriving them. */
  runnerAnchors?: RunnerAnchorOverrides
}

/**
 * A partial brand layer, as stored for partner/client/campaign owners.
 *
 * Merge semantics are SHALLOW at the top-level-field granularity: a defined
 * field wholly replaces the inherited value, and nested groups
 * (`semanticColors`, `taxonomyColors`, `emailStyles`, `reportTheme`,
 * `typography`, `buttonStyle`, `gradientAccent`, `portalAccents`,
 * `surfaceColors`, `runnerAnchors`) are atomic units — you override the whole
 * group or none of it. This matches how the editors edit them and keeps
 * resolution predictable. Within `surfaceColors` / `runnerAnchors` an unset
 * member still falls back to the derived value, so partial pinning works
 * without breaking the atomic-group rule.
 *
 * The platform row must always hold a complete `BrandConfig`; it is the merge
 * base (after `TRAJECTAS_DEFAULTS`). Historic rows that stored full configs
 * for non-platform owners remain valid — they are simply overrides that
 * happen to define every field.
 */
export type BrandOverrides = Partial<BrandConfig>

/**
 * Database row for `brand_configs`.
 *
 * `config` is typed as the override layer: complete for the platform row,
 * partial for partner/client/campaign rows. Use `mergeBrandLayers` (or
 * `getEffectiveBrand`) to obtain a complete `BrandConfig` for rendering.
 */
export interface BrandConfigRow {
  id: string
  owner_type: BrandOwnerType
  owner_id: string | null
  config: BrandOverrides
  is_default: boolean
  created_at: string
  updated_at: string | null
  deleted_at: string | null
}

/** Camel-case TypeScript representation of a brand config record. */
export interface BrandConfigRecord {
  id: string
  ownerType: BrandOwnerType
  ownerId: string | null
  config: BrandOverrides
  isDefault: boolean
  createdAt: string
  updatedAt: string | null
  deletedAt: string | null
}
