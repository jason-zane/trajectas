import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'

export const getFactorSelectionSchema = z.object({
  campaignAssessmentId: postgresUuid(),
})

export const getFactorsForAssessmentSchema = z.object({
  assessmentId: postgresUuid(),
})

export const saveFactorSelectionSchema = z.object({
  campaignAssessmentId: postgresUuid(),
  factorIds: z.array(postgresUuid()),
})

export const clearFactorSelectionSchema = z.object({
  campaignAssessmentId: postgresUuid(),
})

export const getFactorSelectionEstimateSchema = z.object({
  constructCount: z.number().int().min(0),
})
