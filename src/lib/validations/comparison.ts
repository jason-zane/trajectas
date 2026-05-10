import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'

export const eligibleAssessmentsSchema = z.object({
  campaignParticipantIds: z
    .array(postgresUuid('Invalid participant ID'))
    .max(500, 'Too many participants'),
})
export type EligibleAssessmentsInput = z.infer<typeof eligibleAssessmentsSchema>

export const sessionOptionsForRowSchema = z.object({
  campaignParticipantId: postgresUuid('Invalid participant ID'),
  assessmentIds: z
    .array(postgresUuid('Invalid assessment ID'))
    .max(50, 'Too many assessments'),
})
export type SessionOptionsForRowInput = z.infer<typeof sessionOptionsForRowSchema>

export const searchCampaignParticipantsSchema = z.object({
  campaignId: postgresUuid('Invalid campaign ID'),
  query: z.string().max(200, 'Query is too long'),
})
export type SearchCampaignParticipantsInput = z.infer<typeof searchCampaignParticipantsSchema>

export const searchAllParticipantsSchema = z.object({
  query: z.string().max(200, 'Query is too long'),
})
export type SearchAllParticipantsInput = z.infer<typeof searchAllParticipantsSchema>

const entryRequestSchema = z.object({
  campaignParticipantId: postgresUuid('Invalid participant ID'),
  sessionIdsByAssessment: z
    .record(postgresUuid('Invalid assessment ID'), postgresUuid('Invalid session ID'))
    .optional(),
})

export const comparisonRequestSchema = z.object({
  entries: z.array(entryRequestSchema).max(100, 'Too many entries'),
  assessmentIds: z
    .array(postgresUuid('Invalid assessment ID'))
    .max(50, 'Too many assessments'),
  visibleLevels: z
    .array(z.enum(['dimension', 'factor', 'construct']))
    .optional(),
})
export type ComparisonRequestInput = z.infer<typeof comparisonRequestSchema>
