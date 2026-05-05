import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'

const accessToken = z.string().min(1, 'Token is required')

export const validateAccessTokenSchema = z.object({
  token: accessToken,
})

export const getAssessmentItemCountSchema = z.object({
  assessmentIds: z.array(postgresUuid()),
})

export const startSessionSchema = z.object({
  token: accessToken,
  campaignParticipantId: postgresUuid(),
  assessmentId: postgresUuid(),
  campaignId: postgresUuid(),
})

export const getSessionStateSchema = z.object({
  token: accessToken,
  sessionId: postgresUuid(),
})

export const saveResponseSchema = z.object({
  token: accessToken,
  sessionId: postgresUuid(),
  itemId: postgresUuid(),
  sectionId: postgresUuid().optional(),
  responseValue: z.number(),
  responseData: z.record(z.string(), z.unknown()).optional(),
  responseTimeMs: z.number().nonnegative().optional(),
})
export type SaveResponseInput = z.infer<typeof saveResponseSchema>

export const updateSessionProgressSchema = z.object({
  token: accessToken,
  sessionId: postgresUuid(),
  update: z.object({
    currentSectionId: postgresUuid().optional(),
    currentItemIndex: z.number().int().nonnegative().optional(),
    timeRemaining: z.record(z.string(), z.number()).optional(),
  }),
})

export const saveResponseLiteSchema = z.object({
  token: accessToken,
  sessionId: postgresUuid(),
  itemId: postgresUuid(),
  sectionId: postgresUuid(),
  responseValue: z.number(),
  responseData: z.record(z.string(), z.unknown()).optional(),
  responseTimeMs: z.number().nonnegative().optional(),
})
export type SaveResponseLiteInput = z.infer<typeof saveResponseLiteSchema>

export const updateSessionProgressLiteSchema = z.object({
  token: accessToken,
  sessionId: postgresUuid(),
  update: z.object({
    sectionId: postgresUuid(),
    itemIndex: z.number().int().nonnegative(),
  }),
})

export const submitSessionSchema = z.object({
  token: accessToken,
  sessionId: postgresUuid(),
})

export const triggerReportGenerationSchema = z.object({
  sessionId: postgresUuid(),
})

export const getParticipantReportSnapshotSchema = z.object({
  token: accessToken,
  snapshotId: postgresUuid().optional(),
})

export const registerViaLinkSchema = z.object({
  linkToken: z.string().min(1, 'Link token is required'),
  email: z.string().email('Invalid email address').max(500),
  firstName: z.string().min(1, 'First name is required').max(200),
  lastName: z.string().min(1, 'Last name is required').max(200),
  jobTitle: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  marketingConsent: z.boolean().optional(),
})
export type RegisterViaLinkInput = z.infer<typeof registerViaLinkSchema>
