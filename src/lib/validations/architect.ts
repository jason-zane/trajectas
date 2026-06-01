import { z } from 'zod'
import { postgresUuid } from './uuid'

/** Structured brief — mirrors the `Brief` type in @/types/ai. */
export const briefSchema = z.object({
  roleTitle: z.string().max(300).default(''),
  level: z.enum(['ic', 'first_line_manager', 'mid_manager', 'senior_leader', 'executive']),
  function: z.string().max(200).default(''),
  outcome: z.enum(['selection', 'development', 'team_composition']),
  outcomeIntent: z.string().max(300).default(''),
  responsibilities: z.array(z.string().max(500)).default([]),
  contextSignals: z.array(z.string().max(300)).default([]),
  technicalRequirements: z.array(z.string().max(300)).default([]),
  confidence: z.enum(['high', 'medium', 'low']).default('medium'),
})

export const extractBriefSchema = z.object({
  // Upper bound is generous; extractBrief truncates over-long input before
  // validating, so a long CV/JD is trimmed rather than rejected.
  rawText: z.string().min(20, 'Add a bit more detail about the role.').max(60000),
  outcomeIntent: z.string().min(1).max(300),
})

export const runArchitectMatchSchema = z.object({
  brief: briefSchema,
})

const overviewFactorSchema = z.object({
  factorName: z.string().max(200),
  categoryName: z.string().max(200).nullable(),
  rank: z.coerce.number().int(),
})

export const summariseSelectionSchema = z.object({
  brief: briefSchema,
  included: z.array(overviewFactorSchema).max(50),
  excluded: z.array(overviewFactorSchema).max(20),
})

export const createArchitectAssessmentSchema = z.object({
  title: z.string().min(1, 'Name the assessment').max(300),
  description: z.string().max(4000).optional(),
  picks: z
    .array(
      z.object({
        factorId: postgresUuid(),
        itemCount: z.coerce.number().int().min(0).default(0),
        weight: z.coerce.number().positive().optional(),
      }),
    )
    .min(1, 'Select at least one factor'),
})
