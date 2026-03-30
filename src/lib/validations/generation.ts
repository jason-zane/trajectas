import { z } from 'zod'
import { postgresUuid } from './uuid'

export const generationRunConfigSchema = z.object({
  constructIds: z.array(postgresUuid()).min(1, 'Select at least one construct'),
  targetItemsPerConstruct: z.number().int().min(20).max(80).default(60),
  temperature: z.number().min(0.5).max(1.5).default(0.8),
  generationModel: z.string().min(1, 'Generation model is required'),
  embeddingModel: z.string().min(1, 'Embedding model is required'),
  responseFormatId: postgresUuid().optional(),
})

export type GenerationRunConfigInput = z.infer<typeof generationRunConfigSchema>

export const createGenerationRunSchema = z.object({
  config: generationRunConfigSchema,
})

export type CreateGenerationRunInput = z.infer<typeof createGenerationRunSchema>

export const acceptItemsSchema = z.object({
  runId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()).min(1, 'Select at least one item to accept'),
})

export type AcceptItemsInput = z.infer<typeof acceptItemsSchema>
