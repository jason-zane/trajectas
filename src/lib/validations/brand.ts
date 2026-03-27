import { z } from 'zod'

const hexColorRegex = /^#[0-9a-fA-F]{6}$/

export const brandConfigSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  logoUrl: z.string().url().max(2000).optional(),
  logomarkUrl: z.string().url().max(2000).optional(),
  primaryColor: z
    .string()
    .regex(hexColorRegex, 'Must be a valid hex color (e.g., #2d6a5a)'),
  accentColor: z
    .string()
    .regex(hexColorRegex, 'Must be a valid hex color (e.g., #c9a962)'),
  neutralTemperature: z.enum(['warm', 'neutral', 'cool']),
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
  ownerType: z.enum(['platform', 'organization']),
  ownerId: z.string().uuid().nullable(),
  config: brandConfigSchema,
})

export type UpsertBrandConfigInput = z.infer<typeof upsertBrandConfigSchema>
