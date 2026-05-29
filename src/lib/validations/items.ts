import { z } from 'zod'
import { postgresUuid } from './uuid'

export const itemPurposeEnum = z.enum(['construct', 'impression_management', 'infrequency', 'attention_check'])

export const itemDifficultyEnum = z.enum(['easy', 'medium', 'hard'])

export const itemSchema = z.object({
  purpose: itemPurposeEnum.default('construct'),
  constructId: postgresUuid('Construct is required').optional(),
  responseFormatId: postgresUuid('Response format is required'),
  stem: z.string().min(1, 'Item stem is required').max(4000),
  stemObserver: z.string().max(4000).optional().or(z.literal('')),
  reverseScored: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .default(false),
  weight: z.coerce.number().positive('Weight must be positive').default(1.0),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  displayOrder: z.coerce.number().int().min(0).default(0),
  difficulty: itemDifficultyEnum.default('medium'),
  sourceId: z.string().uuid().optional().or(z.literal('')),
  keyedAnswer: z.coerce.number().optional(),
}).superRefine((data, ctx) => {
  if (data.purpose === 'construct' && !data.constructId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Construct is required for construct items',
      path: ['constructId'],
    })
  }
  if (data.purpose === 'attention_check' && data.keyedAnswer == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Keyed answer is required for attention check items',
      path: ['keyedAnswer'],
    })
  }
})

export type ItemInput = z.infer<typeof itemSchema>
