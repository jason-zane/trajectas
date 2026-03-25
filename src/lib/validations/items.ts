import { z } from 'zod'

export const itemOptionSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  value: z.coerce.number(),
  displayOrder: z.coerce.number().int().min(0).default(0),
})

export const sjtRubricSchema = z.object({
  optionIndex: z.coerce.number().int().min(0),
  rubricLabel: z.enum(['best', 'good', 'neutral', 'poor']),
  scoreValue: z.coerce.number().int().min(0).max(10).default(0),
  explanation: z.string().optional(),
})

export const itemSchema = z.object({
  traitId: z.string().uuid('Construct is required'),
  competencyId: z.string().uuid().optional().or(z.literal('')),
  responseFormatId: z.string().uuid('Response format is required'),
  stem: z.string().min(1, 'Item stem is required').max(4000),
  reverseScored: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .default(false),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  displayOrder: z.coerce.number().int().min(0).default(0),
  options: z.array(itemOptionSchema).optional().default([]),
  rubrics: z.array(sjtRubricSchema).optional().default([]),
})

export const forcedChoiceBlockSchema = z.object({
  name: z.string().min(1, 'Block name is required').max(200),
  description: z.string().optional(),
  itemIds: z.array(z.string().uuid()).min(3, 'At least 3 items required').max(4, 'At most 4 items'),
})

export type ItemInput = z.infer<typeof itemSchema>
export type SjtRubricInput = z.infer<typeof sjtRubricSchema>
export type ForcedChoiceBlockInput = z.infer<typeof forcedChoiceBlockSchema>
