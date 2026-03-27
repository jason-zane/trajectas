// =============================================================================
// Brand configuration types
// =============================================================================

/** Neutral tone temperature — controls the hue tint of all gray/neutral tones. */
export type NeutralTemperature = 'warm' | 'neutral' | 'cool'

/** Border radius preset. */
export type BorderRadiusPreset = 'sharp' | 'soft' | 'round'

/** Who owns a brand config. */
export type BrandOwnerType = 'platform' | 'organization'

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
