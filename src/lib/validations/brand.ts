import { z } from 'zod'

const hexColorRegex = /^#[0-9a-fA-F]{6}$/
const hexColor = z.string().regex(hexColorRegex, 'Must be a valid hex color (e.g., #2d6a5a)')

// Brand logos must live on our own Supabase storage bucket — not external
// URLs. This closes two holes at once:
//   1. External logo URLs could exfiltrate a tracking pixel hit for every
//      tenant that views any brand-aware page.
//   2. Locking image sources down lets us tighten CSP `img-src` without
//      breaking customer logos.
function getSupabaseHost(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

const brandLogoUrl = z
  .string()
  .max(2000)
  .refine((value) => {
    if (value === '') return true
    // Allow relative URLs — same-origin, cannot be a tracking pixel.
    if (value.startsWith('/') && !value.startsWith('//')) return true
    try {
      const parsed = new URL(value)
      if (parsed.protocol !== 'https:') return false
      const supabaseHost = getSupabaseHost()
      return Boolean(supabaseHost) && parsed.host === supabaseHost
    } catch {
      return false
    }
  }, 'Logo must be uploaded to the brand-assets bucket (external URLs are not allowed)')

const portalAccentsSchema = z.object({
  admin: hexColor,
  partner: hexColor,
  client: hexColor,
})

// Every member is optional: an unset role stays derived from
// neutralTemperature / the runner anchor derivation.
const surfaceColorsSchema = z.object({
  surface: hexColor.optional(),
  surfaceRaised: hexColor.optional(),
  text: hexColor.optional(),
  textMuted: hexColor.optional(),
  border: hexColor.optional(),
})

const runnerAnchorsSchema = z.object({
  ink: hexColor.optional(),
  paper: hexColor.optional(),
  accent: hexColor.optional(),
  accentOnPaper: hexColor.optional(),
})

const semanticColorsSchema = z.object({
  destructive: hexColor,
  success: hexColor,
  warning: hexColor,
})

const taxonomyColorsSchema = z.object({
  dimension: hexColor,
  competency: hexColor,
  trait: hexColor,
  item: hexColor,
})

const emailStylesSchema = z.object({
  textColor: hexColor,
  highlightColor: hexColor,
  footerTextColor: hexColor,
})

// Report theme colors are hex OR css color functions (e.g. rgba(...) for the
// radar fill). Constrain to characters that cannot break out of a CSS value
// context rather than a strict format.
const reportColor = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[#a-zA-Z0-9(),.%\s/-]+$/, 'Must be a valid CSS color value')

const reportThemeSchema = z.object({
  primaryLogoUrl: brandLogoUrl.optional(),
  secondaryLogoUrl: brandLogoUrl.optional(),
  reportHighBandFill: reportColor,
  reportMidBandFill: reportColor,
  reportLowBandFill: reportColor,
  reportHighBadgeBg: reportColor,
  reportHighBadgeText: reportColor,
  reportMidBadgeBg: reportColor,
  reportMidBadgeText: reportColor,
  reportLowBadgeBg: reportColor,
  reportLowBadgeText: reportColor,
  reportFeaturedBg: reportColor,
  reportFeaturedText: reportColor,
  reportFeaturedAccent: reportColor,
  reportInsetBg: reportColor,
  reportInsetBorder: reportColor,
  reportPageBg: reportColor,
  reportCardBg: reportColor,
  reportCardBorder: reportColor,
  reportDivider: reportColor,
  reportCtaBg: reportColor,
  reportCtaText: reportColor,
  reportHeadingColour: reportColor,
  reportBodyColour: reportColor,
  reportMutedColour: reportColor,
  reportLabelColour: reportColor,
  reportCoverAccent: reportColor,
  reportRadarFill: reportColor,
  reportRadarStroke: reportColor,
  reportRadarPoint: reportColor,
  reportBarDot: reportColor,
  reportRaterSelf: reportColor,
  reportRaterManager: reportColor,
  reportRaterPeers: reportColor,
  reportRaterDirects: reportColor,
  reportRaterOverall: reportColor,
})

const fontWeight = z.number().int().min(300).max(800)

const typeLevelOverrideSchema = z
  .object({
    size: z.string().max(20),
    weight: fontWeight,
    lineHeight: z.number().min(0.8).max(3),
    letterSpacing: z.string().max(20),
  })
  .partial()

const typographySchema = z.object({
  scale: z.enum(['compact', 'default', 'generous']).optional(),
  headingWeight: fontWeight.optional(),
  bodyWeight: fontWeight.optional(),
  levels: z
    .object({
      display: typeLevelOverrideSchema.optional(),
      h1: typeLevelOverrideSchema.optional(),
      h2: typeLevelOverrideSchema.optional(),
      h3: typeLevelOverrideSchema.optional(),
      body: typeLevelOverrideSchema.optional(),
      label: typeLevelOverrideSchema.optional(),
      caption: typeLevelOverrideSchema.optional(),
    })
    .optional(),
})

const buttonStyleSchema = z.object({
  shape: z.enum(['inherit', 'pill', 'sharp']).optional(),
  weight: fontWeight.optional(),
  textTransform: z.enum(['none', 'uppercase']).optional(),
})

const gradientAccentSchema = z.object({
  enabled: z.boolean(),
  angle: z.number().min(0).max(360).optional(),
  from: hexColor.optional(),
  to: hexColor.optional(),
})

export const brandConfigSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  logoUrl: brandLogoUrl.optional(),
  logomarkUrl: brandLogoUrl.optional(),
  primaryColor: hexColor,
  accentColor: hexColor,
  secondaryColor: hexColor.optional(),
  neutralTemperature: z.enum(['warm', 'neutral', 'cool']),
  surfaceColors: surfaceColorsSchema.optional(),
  portalAccents: portalAccentsSchema.optional(),
  sidebarColor: hexColor.optional(),
  backgroundColor: hexColor.optional(),
  cardColor: hexColor.optional(),
  semanticColors: semanticColorsSchema.optional(),
  taxonomyColors: taxonomyColorsSchema.optional(),
  emailStyles: emailStylesSchema.optional(),
  reportTheme: reportThemeSchema.optional(),
  headingFont: z.string().min(1).max(100),
  bodyFont: z.string().min(1).max(100),
  monoFont: z.string().min(1).max(100),
  typography: typographySchema.optional(),
  borderRadius: z.enum(['sharp', 'soft', 'round']),
  spacingDensity: z.enum(['compact', 'comfortable', 'spacious']).optional(),
  buttonStyle: buttonStyleSchema.optional(),
  gradientAccent: gradientAccentSchema.optional(),
  runnerTheme: z.enum(['dark', 'light']).optional(),
  runnerAnchors: runnerAnchorsSchema.optional(),
})

export type BrandConfigInput = z.infer<typeof brandConfigSchema>

/**
 * Partial brand layer for partner/client/campaign owners. Every field is
 * optional; a defined field wholly overrides the inherited value (nested
 * groups are atomic — see BrandOverrides in src/lib/brand/types.ts).
 *
 * The platform config must stay complete: it is the merge base, so it keeps
 * the full `brandConfigSchema`.
 */
export const brandOverridesSchema = brandConfigSchema.partial()

export type BrandOverridesInput = z.infer<typeof brandOverridesSchema>

/** Schema for upserting a brand config record. */
export const upsertBrandConfigSchema = z.object({
  ownerType: z.enum(['platform', 'partner', 'client', 'campaign']),
  ownerId: z.string().uuid().nullable(),
  config: brandOverridesSchema,
})

export type UpsertBrandConfigInput = z.infer<typeof upsertBrandConfigSchema>
