import { z } from 'zod'

export const aiPromptPurposeSchema = z.enum([
  'competency_matching',
  'ranking_explanation',
  'diagnostic_analysis',
  'item_generation',
  'factor_item_generation',
  'library_import_structuring',
  'preflight_analysis',
  'embedding',
  'chat',
  'report_narrative',
  'report_strengths_analysis',
  'report_development_advice',
  'item_critique',
  'synthetic_respondent',
])

export const modelIdSchema = z.string().min(1, 'Model ID is required').max(500)

export const modelConfigOverrideSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().min(1).max(100000).optional(),
})

export const applyModelToAllPurposesSchema = z.object({
  modelId: modelIdSchema,
})
export type ApplyModelToAllPurposesInput = z.infer<typeof applyModelToAllPurposesSchema>

export const updateModelForPurposeSchema = z.object({
  purpose: aiPromptPurposeSchema,
  modelId: modelIdSchema,
  config: modelConfigOverrideSchema.optional(),
})
export type UpdateModelForPurposeInput = z.infer<typeof updateModelForPurposeSchema>
