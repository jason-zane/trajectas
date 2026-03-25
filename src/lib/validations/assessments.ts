import { z } from 'zod'

export const assessmentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300),
  description: z.string().max(4000).optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  itemSelectionStrategy: z.enum(['fixed', 'rule_based', 'cat']).default('fixed'),
  scoringMethod: z.enum(['irt', 'ctt', 'hybrid']).default('ctt'),
  timeLimitMinutes: z.coerce.number().int().min(0).optional(),
  organizationId: z.string().uuid('Organisation is required'),
  creationMode: z.enum(['manual', 'ai_generated', 'org_choice']).default('manual'),
})

export type AssessmentInput = z.infer<typeof assessmentSchema>
