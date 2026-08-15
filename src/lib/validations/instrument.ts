import { z } from 'zod'
import { postgresUuid } from './uuid'
import { MEASURE_TYPES, INTENSITIES } from '@/lib/instrument/types'

/**
 * Validation schemas for instrument builder actions.
 *
 * @module
 */

export const instrumentBuildInputSchema = z.object({
  name: z.string().min(1, 'Build name is required').max(200),
  measureType: z.enum(MEASURE_TYPES),
  brief: z.string().max(500).optional(),
  // nullish, not optional: these columns are nullable in the database and a
  // caller that legitimately does not know them yet sends null, not undefined.
  // `.optional()` rejected null outright, which made the Quick Build wizard
  // fail on its very first step every time.
  targetConstructCount: z.number().int().min(1).max(20).nullish(),
  targetItemsPerConstruct: z.number().int().min(1).max(50).nullish(),
  audience: z.object({
    level: z.enum(['entry', 'mid', 'senior', 'executive', 'mixed', 'open']).optional(),
    description: z.string().optional(),
  }).optional(),
  useContext: z.enum(['development', 'selection', 'research', 'open']).optional(),
})

export type InstrumentBuildInput = z.infer<typeof instrumentBuildInputSchema>

export const instrumentBuildUpdateSchema = instrumentBuildInputSchema.partial()

export type InstrumentBuildUpdate = z.infer<typeof instrumentBuildUpdateSchema>

export const blueprintInputSchema = z.object({
  constructId: postgresUuid().optional(),
  draftConstructName: z.string().min(1, 'Construct name is required').max(200).optional(),
  draftConstructDefinition: z.string().max(1000).optional(),
  targetAlpha: z.number().min(0.5).max(0.95).optional(),
  exclusions: z.array(postgresUuid()).optional(),
  notes: z.string().max(1000).optional(),
})

export type BlueprintInput = z.infer<typeof blueprintInputSchema>

export const blueprintUpdateSchema = blueprintInputSchema.partial()

export type BlueprintUpdate = z.infer<typeof blueprintUpdateSchema>

export const blueprintCellInputSchema = z.object({
  facetLabel: z.string().min(1, 'Facet label is required').max(100),
  facetDefinition: z.string().max(500).optional(),
  intensity: z.enum(INTENSITIES),
  targetItemCount: z.number().int().min(1).max(20),
  displayOrder: z.number().int().min(0),
})

export type BlueprintCellInput = z.infer<typeof blueprintCellInputSchema>

export const saveBlueprintCellsInputSchema = z.object({
  cells: z.array(blueprintCellInputSchema).min(1, 'Blueprint must have at least one cell'),
})

export type SaveBlueprintCellsInput = z.infer<typeof saveBlueprintCellsInputSchema>

export const draftBlueprintWithAiOptionsSchema = z.object({
  modelId: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(100).max(4000).default(2000),
})

export type DraftBlueprintWithAiOptions = z.infer<typeof draftBlueprintWithAiOptionsSchema>

export const generateItemsForBlueprintOptionsSchema = z.object({
  cellIds: z.array(postgresUuid()).optional(),
  modelId: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(100).max(4000).default(2000),
})

export type GenerateItemsForBlueprintOptions = z.infer<typeof generateItemsForBlueprintOptionsSchema>

export const updateCandidateItemStatusSchema = z.object({
  status: z.enum(['candidate', 'accepted', 'rejected']),
})

export type UpdateCandidateItemStatus = z.infer<typeof updateCandidateItemStatusSchema>

export const runCongruencePanelOptionsSchema = z.object({
  raterCount: z.number().int().min(2).max(5).default(3).optional(),
  models: z.array(z.string()).optional(),
})

export type RunCongruencePanelOptions = z.infer<typeof runCongruencePanelOptionsSchema>

export const runFairnessScreenOptionsSchema = z.object({})

export type RunFairnessScreenOptions = z.infer<typeof runFairnessScreenOptionsSchema>

export const publishBuildInputSchema = z.object({
  responseFormatId: postgresUuid(),
  dimensionId: postgresUuid().optional().nullable(),
})

export type PublishBuildInput = z.infer<typeof publishBuildInputSchema>
