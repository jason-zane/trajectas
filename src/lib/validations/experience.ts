import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'

export const demographicsConfigSchema = z.object({
  fields: z.array(z.object({
    key: z.string().regex(/^[a-z][a-z0-9_]*$/).max(64),
    enabled: z.boolean(),
    required: z.boolean(),
    label: z.string().trim().min(1).max(200),
    type: z.enum(['select', 'text']),
    options: z.array(z.object({
      value: z.string().trim().min(1).max(500),
      label: z.string().trim().min(1).max(200),
    })).max(200).optional(),
  }).superRefine((field, ctx) => {
    if (field.type === 'select' && !field.options?.length) ctx.addIssue({ code: 'custom', message: 'Select fields need options' });
    if (field.options && new Set(field.options.map(o => o.value)).size !== field.options.length) ctx.addIssue({ code: 'custom', message: 'Option values must be unique' });
  })).max(50),
}).superRefine((config, ctx) => {
  if (new Set(config.fields.map(f => f.key)).size !== config.fields.length) ctx.addIssue({ code: 'custom', message: 'Field keys must be unique' });
})

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
  demographicsConfig: demographicsConfigSchema,
})
export type UpsertExperienceDemographicsInput = z.infer<typeof upsertExperienceDemographicsSchema>

export const upsertExperienceTemplateSchema = z.object({
  ownerType: experienceOwnerTypeSchema,
  ownerId: postgresUuid().nullable(),
  template: z.object({
    pageContent: z.record(z.string(), z.unknown()).optional(),
    flowConfig: z.record(z.string(), z.unknown()).optional(),
    demographicsConfig: demographicsConfigSchema.optional(),
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
  contentVersion: z.string().regex(/^[a-f0-9]{64}$/),
  token: z.string().min(1),
  participantId: postgresUuid(),
})
export type SaveConsentInput = z.infer<typeof saveConsentSchema>

export const saveDemographicsSchema = z.object({
  token: z.string().min(1),
  participantId: postgresUuid(),
  demographics: z.record(z.string().min(1).max(64), z.string().max(500)),
  researchPermission: z.boolean().default(false),
})
export type SaveDemographicsInput = z.infer<typeof saveDemographicsSchema>
