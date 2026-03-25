import { z } from 'zod'

export const traitSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(200)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(2000).optional(),
  definition: z.string().max(4000).optional(),
  isActive: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .default(true),
  indicatorsLow: z.string().max(4000).optional(),
  indicatorsMid: z.string().max(4000).optional(),
  indicatorsHigh: z.string().max(4000).optional(),
})

export type TraitInput = z.infer<typeof traitSchema>
