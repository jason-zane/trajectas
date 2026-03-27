import type { BrandConfig } from './types'

/**
 * The Talent Fit platform default brand configuration.
 *
 * Sage/teal primary, gold accent, Plus Jakarta Sans typography, soft radius.
 * This is used as the seed value for the platform brand_config row and as
 * the fallback when no organization-specific brand is configured.
 */
export const TALENT_FIT_DEFAULTS: Readonly<BrandConfig> = {
  name: 'TalentFit',
  primaryColor: '#2d6a5a',
  accentColor: '#c9a962',
  neutralTemperature: 'neutral',
  headingFont: 'Plus Jakarta Sans',
  bodyFont: 'Plus Jakarta Sans',
  monoFont: 'Geist Mono',
  borderRadius: 'soft',
  darkModeEnabled: true,
}
