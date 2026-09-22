import { z } from 'zod'

import { AI_PROMPT_PURPOSES } from '@/lib/ai/purposes'
import { isJevModelId } from '@/lib/ai/model-ids'

export const aiPromptPurposeSchema = z.enum(AI_PROMPT_PURPOSES)

export const modelIdSchema = z.string().min(1, 'Model ID is required').max(500)

export const modelConfigOverrideSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().min(1).max(100000).optional(),
})

// Decision models (Jev, `typesafe/…`) are a distinct model family that only
// the competency_matching purpose knows how to call — see the "Runtime
// switch" section of docs/superpowers/specs/2026-09-22-jev-competency-matching-design.md.
export const applyModelToAllPurposesSchema = z.object({
  modelId: modelIdSchema,
}).superRefine((data, ctx) => {
  if (isJevModelId(data.modelId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['modelId'],
      message: 'Decision models cannot be applied to all purposes.',
    })
  }
})
export type ApplyModelToAllPurposesInput = z.infer<typeof applyModelToAllPurposesSchema>

export const updateModelForPurposeSchema = z.object({
  purpose: aiPromptPurposeSchema,
  modelId: modelIdSchema,
  config: modelConfigOverrideSchema.optional(),
}).superRefine((data, ctx) => {
  if (isJevModelId(data.modelId) && data.purpose !== 'competency_matching') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['modelId'],
      message: 'Decision models can only be used for competency matching.',
    })
  }
})
export type UpdateModelForPurposeInput = z.infer<typeof updateModelForPurposeSchema>
