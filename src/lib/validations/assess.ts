import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'

export const validateAccessTokenSchema = z.object({
  token: z.string().min(1),
})

export const getAssessmentItemCountSchema = z.object({
  assessmentIds: z.array(postgresUuid()),
})

export const startSessionSchema = z.object({
  token: z.string().min(1),
  campaignParticipantId: postgresUuid(),
  assessmentId: postgresUuid(),
  campaignId: postgresUuid(),
})

export const getSessionStateSchema = z.object({
  token: z.string().min(1),
  sessionId: postgresUuid(),
})

export const saveResponseSchema = z.object({
  token: z.string().min(1),
  sessionId: postgresUuid(),
  itemId: postgresUuid(),
  sectionId: postgresUuid().optional(),
  responseValue: z.number(),
  responseData: z.record(z.string(), z.unknown()).optional(),
  responseTimeMs: z.number().int().min(0).optional(),
})

export const updateSessionProgressSchema = z.object({
  token: z.string().min(1),
  sessionId: postgresUuid(),
  update: z.object({
    currentSectionId: postgresUuid().optional(),
    currentItemIndex: z.number().int().min(0).optional(),
    timeRemaining: z.record(z.string(), z.number()).optional(),
  }),
})

export const saveResponseLiteSchema = z.object({
  token: z.string().min(1),
  sessionId: postgresUuid(),
  itemId: postgresUuid(),
  sectionId: postgresUuid(),
  responseValue: z.number(),
  responseData: z.record(z.string(), z.unknown()).optional(),
  responseTimeMs: z.number().int().min(0).optional(),
})

export const updateSessionProgressLiteSchema = z.object({
  token: z.string().min(1),
  sessionId: postgresUuid(),
  update: z.object({
    sectionId: postgresUuid(),
    itemIndex: z.number().int().min(0),
  }),
})

export const submitSessionSchema = z.object({
  token: z.string().min(1),
  sessionId: postgresUuid(),
})

export const triggerReportGenerationSchema = z.object({
  sessionId: postgresUuid(),
})

export const getParticipantReportSnapshotSchema = z.object({
  token: z.string().min(1),
  snapshotId: postgresUuid().optional(),
})

export const registerViaLinkSchema = z.object({
  linkToken: z.string().min(1),
  email: z.string().email('Valid email is required'),
  firstName: z.string().min(1, 'First name is required').max(200),
  lastName: z.string().min(1, 'Last name is required').max(200),
  jobTitle: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  marketingConsent: z.boolean().optional(),
})

export type RegisterViaLinkInput = z.infer<typeof registerViaLinkSchema>
