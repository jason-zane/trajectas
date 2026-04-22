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

export const brandConfigSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  logoUrl: brandLogoUrl.optional(),
  logomarkUrl: brandLogoUrl.optional(),
  primaryColor: hexColor,
  accentColor: hexColor,
  neutralTemperature: z.enum(['warm', 'neutral', 'cool']),
  portalAccents: portalAccentsSchema.optional(),
  sidebarColor: hexColor.optional(),
  backgroundColor: hexColor.optional(),
  cardColor: hexColor.optional(),
  semanticColors: semanticColorsSchema.optional(),
  taxonomyColors: taxonomyColorsSchema.optional(),
  emailStyles: emailStylesSchema.optional(),
  headingFont: z.string().min(1).max(100),
  bodyFont: z.string().min(1).max(100),
  monoFont: z.string().min(1).max(100),
  borderRadius: z.enum(['sharp', 'soft', 'round']),
})

export type BrandConfigInput = z.infer<typeof brandConfigSchema>

/** Schema for upserting a brand config record. */
export const upsertBrandConfigSchema = z.object({
  ownerType: z.enum(['platform', 'partner', 'client', 'campaign']),
  ownerId: z.string().uuid().nullable(),
  config: brandConfigSchema,
})

export type UpsertBrandConfigInput = z.infer<typeof upsertBrandConfigSchema>
