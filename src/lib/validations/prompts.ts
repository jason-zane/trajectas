import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'

const aiPromptPurpose = z.enum([
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

export const getPromptVersionsSchema = z.object({
  purpose: aiPromptPurpose,
})

export const createPromptVersionSchema = z.object({
  purpose: aiPromptPurpose,
  content: z.string().min(1, 'Prompt content is required'),
  name: z.string().max(200).optional(),
})

export const activatePromptVersionSchema = z.object({
  purpose: aiPromptPurpose,
  versionId: postgresUuid(),
})

export type GetPromptVersionsInput = z.infer<typeof getPromptVersionsSchema>
export type CreatePromptVersionInput = z.infer<typeof createPromptVersionSchema>
export type ActivatePromptVersionInput = z.infer<typeof activatePromptVersionSchema>
