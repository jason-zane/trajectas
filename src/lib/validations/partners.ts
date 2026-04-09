import { z } from 'zod'

export const partnerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(200)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug must be lowercase alphanumeric with hyphens'),
  isActive: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .default(true),
  description: z.string().nullable().optional().default(null),
  website: z.string().nullable().optional().default(null),
  contactEmail: z.string().nullable().optional().default(null),
  notes: z.string().nullable().optional().default(null),
})

export type PartnerInput = z.infer<typeof partnerSchema>
