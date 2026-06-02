import { z } from 'zod'
import { postgresUuid } from './uuid'

export const factorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(200)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(2000).optional(),
  definition: z.string().max(4000).optional(),
  dimensionId: postgresUuid().optional().or(z.literal('')),
  isActive: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .default(true),
  isMatchEligible: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .default(true),
  clientId: z.string().uuid().optional().or(z.literal('')),
  constructs: z
    .array(
      z.object({
        constructId: postgresUuid(),
        weight: z.coerce.number().positive('Weight must be positive'),
      })
    )
    .optional()
    .default([]),
  indicatorsLow: z.string().max(4000).optional(),
  indicatorsMid: z.string().max(4000).optional(),
  indicatorsHigh: z.string().max(4000).optional(),
  anchorLow: z.string().max(500).optional(),
  anchorHigh: z.string().max(500).optional(),
  developmentSuggestion: z.string().max(4000).optional(),
  strengthCommentary: z.string().max(4000).optional(),
  sourceId: z.string().uuid().optional().or(z.literal('')),
  // Architect eligibility tags. Empty arrays mean "applies to all".
  applicableOutcomes: z
    .array(z.enum(['selection', 'development', 'team_composition']))
    .optional()
    .default([]),
  applicableLevels: z
    .array(z.enum(['ic', 'first_line_manager', 'mid_manager', 'senior_leader', 'executive']))
    .optional()
    .default([]),
  applicableFunctions: z.array(z.string().max(60)).optional().default([]),
  primaryCategoryId: z.string().uuid().optional().or(z.literal('')),
  secondaryCategoryId: z.string().uuid().optional().or(z.literal('')),
  overuseSignature: z.string().max(4000).optional(),
  contrastsWith: z.array(z.string().max(120)).optional().default([]),
  theoreticalLineage: z.string().max(500).optional(),
}).refine(
  // A match-eligible factor must carry a primary category, so the Architect's
  // whole-person coverage is never polluted by "Uncategorised" factors.
  (d) => !d.isMatchEligible || !!(d.primaryCategoryId && d.primaryCategoryId.length > 0),
  { message: 'A primary category is required for match-eligible factors.', path: ['primaryCategoryId'] },
)

export type FactorInput = z.infer<typeof factorSchema>
