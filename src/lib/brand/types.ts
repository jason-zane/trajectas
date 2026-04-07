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

/**
 * Complete brand configuration. Stored as JSONB in the `brand_configs` table.
 *
 * Colors are stored as hex strings. The token pipeline converts to OKLCH
 * internally to generate perceptually uniform 10-step scales.
 */
export interface BrandConfig {
  /** Display name (e.g., "Talent Fit" or org name). */
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
   * Controls the hue tint of neutral tones (backgrounds, borders, muted text).
   * - `warm` shifts neutrals toward amber
   * - `cool` shifts neutrals toward blue
   * - `neutral` keeps neutrals achromatic
   */
  neutralTemperature: NeutralTemperature

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

  // -- Shape ----------------------------------------------------------------

  /**
   * Border radius preset.
   * - `sharp` → 4px base
   * - `soft`  → 8px base  (default)
   * - `round` → 16px base
   */
  borderRadius: BorderRadiusPreset

  // -- Surfaces -------------------------------------------------------------

  /** Whether dark mode is available (respects system preference). */
  darkModeEnabled: boolean
}

/** Database row for `brand_configs`. */
export interface BrandConfigRow {
  id: string
  owner_type: BrandOwnerType
  owner_id: string | null
  config: BrandConfig
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
  config: BrandConfig
  isDefault: boolean
  createdAt: string
  updatedAt: string | null
  deletedAt: string | null
}
