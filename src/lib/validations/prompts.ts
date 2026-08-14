import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'
import { AI_PROMPT_PURPOSES } from '@/lib/ai/purposes'

const aiPromptPurpose = z.enum(AI_PROMPT_PURPOSES)

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
