import { z } from 'zod'

const hexColorRegex = /^#[0-9a-fA-F]{6}$/
const hexColor = z.string().regex(hexColorRegex, 'Must be a valid hex color (e.g., #2d6a5a)')

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
  logoUrl: z.string().url().max(2000).optional(),
  logomarkUrl: z.string().url().max(2000).optional(),
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
  darkModeEnabled: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .default(true),
})

export type BrandConfigInput = z.infer<typeof brandConfigSchema>

/** Schema for upserting a brand config record. */
export const upsertBrandConfigSchema = z.object({
  ownerType: z.enum(['platform', 'client']),
  ownerId: z.string().uuid().nullable(),
  config: brandConfigSchema,
})

export type UpsertBrandConfigInput = z.infer<typeof upsertBrandConfigSchema>
