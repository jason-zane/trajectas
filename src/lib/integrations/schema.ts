import { z } from 'zod'

const remoteRefSchema = z.object({
  sourceSystem: z
    .string()
    .trim()
    .min(1, 'sourceSystem is required')
    .max(80, 'sourceSystem must be 80 characters or fewer'),
  remoteObjectType: z
    .string()
    .trim()
    .min(1, 'remoteObjectType is required')
    .max(80, 'remoteObjectType must be 80 characters or fewer'),
  remoteId: z
    .string()
    .trim()
    .min(1, 'remoteId is required')
    .max(200, 'remoteId must be 200 characters or fewer'),
  secondaryRemoteId: z
    .string()
    .trim()
    .max(200, 'secondaryRemoteId must be 200 characters or fewer')
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const reportConfigSchema = z.object({
  participantTemplateId: z.string().uuid().optional().nullable(),
  hrManagerTemplateId: z.string().uuid().optional().nullable(),
  consultantTemplateId: z.string().uuid().optional().nullable(),
  brandMode: z.enum(['platform', 'client', 'custom']).optional(),
})

export const createIntegrationCampaignSchema = z.object({
  title: z.string().trim().min(1).max(300),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(4000).optional(),
  status: z.enum(['draft', 'active', 'paused', 'closed', 'archived']).default('draft'),
  opensAt: z.string().optional(),
  closesAt: z.string().optional(),
  allowResume: z.boolean().default(true),
  showProgress: z.boolean().default(true),
  randomizeAssessmentOrder: z.boolean().default(false),
  assessmentIds: z.array(z.string().uuid()).max(25).optional(),
  reportConfig: reportConfigSchema.optional(),
  externalRefs: z.array(remoteRefSchema).max(10).optional(),
})

export const upsertIntegrationParticipantSchema = z.object({
  email: z.string().email(),
  firstName: z.string().trim().max(200).optional(),
  lastName: z.string().trim().max(200).optional(),
  status: z
    .enum(['invited', 'registered', 'in_progress', 'completed', 'withdrawn', 'expired'])
    .optional(),
  externalRefs: z.array(remoteRefSchema).max(10).optional(),
})

export const createIntegrationLaunchSchema = z.object({
  participantId: z.string().uuid(),
  deliveryMethod: z.enum(['link', 'email']).default('link'),
})

export const dispatchIntegrationWebhookSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(25),
})
