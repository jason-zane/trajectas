import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'

const experienceOwnerTypeSchema = z.enum(['platform', 'campaign'])

export const getExperienceTemplateSchema = z.object({
  ownerType: experienceOwnerTypeSchema,
  ownerId: postgresUuid().nullable(),
})
export type GetExperienceTemplateInput = z.infer<typeof getExperienceTemplateSchema>

export const getEffectiveExperienceSchema = z.object({
  campaignId: postgresUuid().nullable().optional(),
})
export type GetEffectiveExperienceInput = z.infer<typeof getEffectiveExperienceSchema>

export const upsertExperiencePageContentSchema = z.object({
  ownerType: experienceOwnerTypeSchema,
  ownerId: postgresUuid().nullable(),
  pageContent: z.record(z.string(), z.unknown()),
})
export type UpsertExperiencePageContentInput = z.infer<typeof upsertExperiencePageContentSchema>

export const upsertExperienceFlowConfigSchema = z.object({
  ownerType: experienceOwnerTypeSchema,
  ownerId: postgresUuid().nullable(),
  flowConfig: z.record(z.string(), z.unknown()),
})
export type UpsertExperienceFlowConfigInput = z.infer<typeof upsertExperienceFlowConfigSchema>

export const upsertExperienceDemographicsSchema = z.object({
  ownerType: experienceOwnerTypeSchema,
  ownerId: postgresUuid().nullable(),
  demographicsConfig: z.object({ fields: z.array(z.unknown()) }),
})
export type UpsertExperienceDemographicsInput = z.infer<typeof upsertExperienceDemographicsSchema>

export const upsertExperienceTemplateSchema = z.object({
  ownerType: experienceOwnerTypeSchema,
  ownerId: postgresUuid().nullable(),
  template: z.object({
    pageContent: z.record(z.string(), z.unknown()).optional(),
    flowConfig: z.record(z.string(), z.unknown()).optional(),
    demographicsConfig: z.object({ fields: z.array(z.unknown()) }).optional(),
    customPageContent: z.record(z.string(), z.unknown()).optional(),
    privacyUrl: z.string().max(2000).optional(),
    termsUrl: z.string().max(2000).optional(),
  }),
})
export type UpsertExperienceTemplateInput = z.infer<typeof upsertExperienceTemplateSchema>

export const resetExperienceToDefaultSchema = z.object({
  ownerType: experienceOwnerTypeSchema,
  ownerId: postgresUuid().nullable(),
})
export type ResetExperienceToDefaultInput = z.infer<typeof resetExperienceToDefaultSchema>

export const saveConsentSchema = z.object({
  token: z.string().min(1),
  participantId: postgresUuid(),
})
export type SaveConsentInput = z.infer<typeof saveConsentSchema>

export const saveDemographicsSchema = z.object({
  token: z.string().min(1),
  participantId: postgresUuid(),
  demographics: z.record(z.string(), z.string()),
})
export type SaveDemographicsInput = z.infer<typeof saveDemographicsSchema>
