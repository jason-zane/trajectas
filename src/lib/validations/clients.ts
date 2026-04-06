import { z } from 'zod'

export const clientSchema = z.object({
  partnerId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined)),
  name: z.string().min(1, 'Name is required').max(200),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(200)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug must be lowercase alphanumeric with hyphens'),
  industry: z.string().max(200).optional(),
  sizeRange: z.string().max(100).optional(),
  isActive: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .default(true),
})

export type ClientInput = z.infer<typeof clientSchema>
