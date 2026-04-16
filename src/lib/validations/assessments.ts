import { z } from 'zod'
import { postgresUuid } from './uuid'

export const assessmentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300),
  description: z.string().max(4000).optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  itemSelectionStrategy: z.enum(['fixed', 'rule_based', 'cat']).default('fixed'),
  scoringMethod: z.literal('ctt').default('ctt'),
  creationMode: z.enum(['manual', 'ai_generated', 'org_choice']).default('manual'),
  formatMode: z.enum(['traditional', 'forced_choice']).default('traditional'),
  fcBlockSize: z.coerce.number().int().min(3).max(4).optional(),
  scoringLevel: z.enum(['factor', 'construct']).default('factor'),
  minCustomConstructs: z.coerce.number().int().nonnegative().nullable().optional(),
  factors: z.array(z.object({
    factorId: postgresUuid(),
    weight: z.coerce.number().positive().default(1),
    itemCount: z.coerce.number().int().min(0).default(0),
  })).default([]),
  constructs: z.array(z.object({
    constructId: postgresUuid(),
    dimensionId: postgresUuid().nullable().optional(),
    weight: z.coerce.number().positive().default(1),
    itemCount: z.coerce.number().int().min(0).default(0),
  })).default([]),
}).refine(
  (data) => data.formatMode !== 'forced_choice' || data.fcBlockSize != null,
  { message: 'Block size is required for forced-choice assessments', path: ['fcBlockSize'] },
)

export type AssessmentInput = z.infer<typeof assessmentSchema>
