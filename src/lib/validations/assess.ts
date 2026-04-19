import { z } from 'zod'
import { postgresUuid } from './uuid'

export const assessAccessTokenSchema = z.object({
  token: z.string().min(1, 'Access token is required'),
})

export const assessmentItemCountSchema = z.object({
  assessmentIds: z.array(postgresUuid('Invalid assessment ID')),
})

export const startSessionSchema = z.object({
  token: z.string().min(1, 'Access token is required'),
  campaignParticipantId: postgresUuid('Invalid participant ID'),
  assessmentId: postgresUuid('Invalid assessment ID'),
  campaignId: postgresUuid('Invalid campaign ID'),
})

export const getSessionStateSchema = z.object({
  token: z.string().min(1, 'Access token is required'),
  sessionId: postgresUuid('Invalid session ID'),
})

export const saveResponseSchema = z.object({
  token: z.string().min(1, 'Access token is required'),
  sessionId: postgresUuid('Invalid session ID'),
  itemId: postgresUuid('Invalid item ID'),
  sectionId: postgresUuid('Invalid section ID').optional(),
  responseValue: z.number(),
  responseData: z.record(z.unknown()).optional(),
  responseTimeMs: z.number().int().min(0).optional(),
})

export const updateSessionProgressSchema = z.object({
  token: z.string().min(1, 'Access token is required'),
  sessionId: postgresUuid('Invalid session ID'),
  currentSectionId: postgresUuid('Invalid section ID').optional(),
  currentItemIndex: z.number().int().min(0).optional(),
  timeRemaining: z.record(z.number()).optional(),
})

export const saveResponseLiteSchema = z.object({
  token: z.string().min(1, 'Access token is required'),
  sessionId: postgresUuid('Invalid session ID'),
  itemId: postgresUuid('Invalid item ID'),
  sectionId: postgresUuid('Invalid section ID'),
  responseValue: z.number(),
  responseData: z.record(z.unknown()).optional(),
  responseTimeMs: z.number().int().min(0).optional(),
})

export const updateSessionProgressLiteSchema = z.object({
  token: z.string().min(1, 'Access token is required'),
  sessionId: postgresUuid('Invalid session ID'),
  sectionId: postgresUuid('Invalid section ID'),
  itemIndex: z.number().int().min(0),
})

export const submitSessionSchema = z.object({
  token: z.string().min(1, 'Access token is required'),
  sessionId: postgresUuid('Invalid session ID'),
})

export const triggerReportGenerationSchema = z.object({
  sessionId: postgresUuid('Invalid session ID'),
})

export const participantReportSnapshotSchema = z.object({
  token: z.string().min(1, 'Access token is required'),
  snapshotId: postgresUuid('Invalid snapshot ID').optional(),
})

export const registerViaLinkSchema = z.object({
  linkToken: z.string().min(1, 'Link token is required'),
  email: z.string().email('A valid email is required'),
  firstName: z.string().min(1, 'First name is required').max(200),
  lastName: z.string().min(1, 'Last name is required').max(200),
  jobTitle: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  marketingConsent: z.boolean().optional(),
})
