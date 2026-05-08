import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'

const accessToken = z.string().min(1, 'Token is required')

export const validateAccessTokenInputSchema = z.object({
  token: accessToken,
})

export const getAssessmentItemCountInputSchema = z.object({
  assessmentIds: z.array(postgresUuid()),
})

export const startSessionInputSchema = z.object({
  token: accessToken,
  campaignParticipantId: postgresUuid(),
  assessmentId: postgresUuid(),
  campaignId: postgresUuid(),
})

export const getSessionStateInputSchema = z.object({
  token: accessToken,
  sessionId: postgresUuid(),
})

export const saveResponseInputSchema = z.object({
  token: accessToken,
  sessionId: postgresUuid(),
  itemId: postgresUuid(),
  sectionId: postgresUuid().optional(),
  responseValue: z.number(),
  responseData: z.record(z.string(), z.unknown()).optional(),
  responseTimeMs: z.number().int().optional(),
})

export const updateSessionProgressInputSchema = z.object({
  token: accessToken,
  sessionId: postgresUuid(),
  update: z.object({
    currentSectionId: postgresUuid().optional(),
    currentItemIndex: z.number().int().optional(),
    timeRemaining: z.record(z.string(), z.number()).optional(),
  }),
})

export const saveResponseLiteInputSchema = z.object({
  token: accessToken,
  sessionId: postgresUuid(),
  itemId: postgresUuid(),
  sectionId: postgresUuid(),
  responseValue: z.number(),
  responseData: z.record(z.string(), z.unknown()).optional(),
  responseTimeMs: z.number().int().optional(),
})

export const updateSessionProgressLiteInputSchema = z.object({
  token: accessToken,
  sessionId: postgresUuid(),
  update: z.object({
    sectionId: postgresUuid(),
    itemIndex: z.number().int(),
  }),
})

export const submitSessionInputSchema = z.object({
  token: accessToken,
  sessionId: postgresUuid(),
})

export const triggerReportGenerationInputSchema = z.object({
  sessionId: postgresUuid(),
})

export const getParticipantReportSnapshotInputSchema = z.object({
  token: accessToken,
  snapshotId: postgresUuid().optional(),
})

export const registerViaLinkInputSchema = z.object({
  linkToken: z.string().min(1, 'Link token is required'),
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  jobTitle: z.string().optional(),
  company: z.string().optional(),
  marketingConsent: z.boolean().optional(),
})
