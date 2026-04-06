import type { BrandConfig, PortalAccents, SemanticColors, TaxonomyColors, EmailStyleColors } from './types'
import { DEFAULT_REPORT_THEME } from '@/lib/reports/presentation'

/** Default portal accent colors. */
export const DEFAULT_PORTAL_ACCENTS: Readonly<PortalAccents> = {
  admin: '#6d28d9',
  partner: '#d4a032',
  client: '#b85c3a',
}

/** Default semantic status colors. */
export const DEFAULT_SEMANTIC_COLORS: Readonly<SemanticColors> = {
  destructive: '#c53030',
  success: '#2f855a',
  warning: '#c27803',
}

/** Default taxonomy level colors. */
export const DEFAULT_TAXONOMY_COLORS: Readonly<TaxonomyColors> = {
  dimension: '#5b3fc5',
  competency: '#2d6a5a',
  trait: '#a33fa3',
  item: '#c27803',
}

/** Default email style colors. */
export const DEFAULT_EMAIL_STYLES: Readonly<EmailStyleColors> = {
  textColor: '#1a1a1a',
  highlightColor: '#2d6a5a',
  footerTextColor: '#737373',
}

/**
 * The Talent Fit platform default brand configuration.
 *
 * Sage/teal primary, gold accent, Plus Jakarta Sans typography, soft radius.
 * This is used as the seed value for the platform brand_config row and as
 * the fallback when no client-specific brand is configured.
 */
export const TALENT_FIT_DEFAULTS: Readonly<BrandConfig> = {
  name: 'TalentFit',
  primaryColor: '#2d6a5a',
  accentColor: '#c9a962',
  neutralTemperature: 'neutral',
  portalAccents: { ...DEFAULT_PORTAL_ACCENTS },
  sidebarColor: '#2d6a5a',
  semanticColors: { ...DEFAULT_SEMANTIC_COLORS },
  taxonomyColors: { ...DEFAULT_TAXONOMY_COLORS },
  emailStyles: { ...DEFAULT_EMAIL_STYLES },
  reportTheme: { ...DEFAULT_REPORT_THEME },
  headingFont: 'Plus Jakarta Sans',
  bodyFont: 'Plus Jakarta Sans',
  monoFont: 'Geist Mono',
  borderRadius: 'soft',
  darkModeEnabled: true,
}
