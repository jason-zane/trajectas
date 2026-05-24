import { z } from 'zod'
import { postgresUuid } from './uuid'

const constructOverrideSchema = z.object({
  definition: z.string().optional(),
  description: z.string().optional(),
  indicatorsLow: z.string().optional(),
  indicatorsMid: z.string().optional(),
  indicatorsHigh: z.string().optional(),
})

// =============================================================================
// Steering inputs — new in the refactor
// =============================================================================

export const measurementModeSchema = z.enum([
  'behavioural',
  'trait',
  'capability',
  'situational',
  'open',
])

export const useContextSchema = z.enum([
  'development',
  'selection',
  'research',
  'open',
])

export const audienceSchema = z.object({
  level: z
    .enum(['entry', 'mid', 'senior', 'executive', 'mixed', 'open'])
    .optional(),
  description: z.string().optional(),
})

export const presetExemplarSchema = z.object({
  stem: z.string().min(1, 'Exemplar stem is required'),
  verdict: z.enum(['good', 'bad']),
  reason: z.string().min(1, 'Exemplar reason is required'),
})

export const playbookSnapshotSchema = z.object({
  rubric: z.string().optional(),
  exemplars: z.array(presetExemplarSchema).optional(),
  critiqueEmphasis: z.string().optional(),
  sdTolerance: z.enum(['low', 'moderate', 'high']).optional(),
  difficultyMix: z
    .object({
      easy: z.number().min(0).max(1).optional(),
      moderate: z.number().min(0).max(1).optional(),
      hard: z.number().min(0).max(1).optional(),
    })
    .optional(),
  critiqueStrictness: z.enum(['lenient', 'standard', 'strict']).optional(),
  sourcePresetId: postgresUuid().optional(),
  sourcePresetName: z.string().optional(),
  modifiedFromPreset: z.boolean().optional(),
})

// =============================================================================
// Generation run config
// =============================================================================

export const generationRunConfigSchema = z
  .object({
    constructIds: z.array(postgresUuid()).min(1, 'Select at least one construct'),
    targetItemsPerConstruct: z.number().int().min(20).max(80).default(60),
    temperature: z.number().min(0.5).max(1.5).default(0.8),
    generationModel: z.string().min(1, 'Generation model is required'),
    embeddingModel: z.string().min(1, 'Embedding model is required'),
    networkEstimator: z.enum(['tmfg', 'ebicglasso']).default('tmfg'),
    responseFormatId: postgresUuid().optional(),
    promptPurpose: z
      .enum(['item_generation', 'factor_item_generation'])
      .default('item_generation'),
    constructOverrides: z.record(z.string(), constructOverrideSchema).optional(),
    enableItemCritique: z.boolean().optional(),
    enableLeakageGuard: z.boolean().optional(),
    enableDifficultyTargeting: z.boolean().optional(),
    enableSyntheticValidation: z.boolean().optional(),

    presetId: postgresUuid().optional(),
    measurementMode: measurementModeSchema.optional(),
    measurementModeDescription: z.string().optional(),
    audience: audienceSchema.optional(),
    useContext: useContextSchema.optional(),
    useContextDescription: z.string().optional(),

    playbookSnapshot: playbookSnapshotSchema.optional(),
  })
  .superRefine((config, ctx) => {
    if (
      config.measurementMode === 'open' &&
      !config.measurementModeDescription?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['measurementModeDescription'],
        message: 'A description is required when measurement mode is "open"',
      })
    }
    if (
      config.useContext === 'open' &&
      !config.useContextDescription?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['useContextDescription'],
        message: 'A description is required when use-context is "open"',
      })
    }
    if (
      config.audience?.level === 'open' &&
      !config.audience?.description?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['audience', 'description'],
        message: 'An audience description is required when level is "open"',
      })
    }
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

// =============================================================================
// Preset CRUD validation
// =============================================================================

export const presetPipelineDefaultsSchema = z.object({
  enableItemCritique: z.boolean().optional(),
  enableLeakageGuard: z.boolean().optional(),
  enableDifficultyTargeting: z.boolean().optional(),
  enableSyntheticValidation: z.boolean().optional(),
})

export const presetWriteSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(120),
    description: z.string().max(500).optional(),
    measurementMode: measurementModeSchema,
    measurementModeDescription: z.string().max(2000).optional(),
    audience: audienceSchema.default({}),
    useContext: useContextSchema,
    useContextDescription: z.string().max(2000).optional(),
    responseFormatId: postgresUuid().optional(),
    responseFormatRationale: z.string().max(500).optional(),
    rubric: z.string().max(8000).optional(),
    exemplars: z.array(presetExemplarSchema).max(12).default([]),
    critiqueEmphasis: z.string().max(2000).optional(),
    sdTolerance: z.enum(['low', 'moderate', 'high']).optional(),
    difficultyMix: z
      .object({
        easy: z.number().min(0).max(1).optional(),
        moderate: z.number().min(0).max(1).optional(),
        hard: z.number().min(0).max(1).optional(),
      })
      .optional(),
    critiqueStrictness: z
      .enum(['lenient', 'standard', 'strict'])
      .default('standard'),
    pipelineDefaults: presetPipelineDefaultsSchema.default({}),
    recommendedTargetPerConstruct: z.number().int().min(20).max(200).default(60),
  })
  .superRefine((preset, ctx) => {
    if (preset.measurementMode === 'open' && !preset.measurementModeDescription?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['measurementModeDescription'],
        message: 'A description is required when measurement mode is "open"',
      })
    }
    if (preset.useContext === 'open' && !preset.useContextDescription?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['useContextDescription'],
        message: 'A description is required when use-context is "open"',
      })
    }
  })

export type PresetWriteInput = z.infer<typeof presetWriteSchema>
