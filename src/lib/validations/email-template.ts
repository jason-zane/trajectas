import { z } from 'zod'
import { EMAIL_TYPES } from '@/lib/email/types'

export const emailTemplateTypeSchema = z.enum(EMAIL_TYPES)
export const emailTemplateScopeSchema = z.enum(['platform', 'partner', 'client'] as const)

export const upsertEmailTemplateSchema = z.object({
  type: emailTemplateTypeSchema,
  scopeType: emailTemplateScopeSchema,
  scopeId: z.string().uuid().nullable(),
  subject: z.string().min(1, 'Subject is required').max(500),
  previewText: z.string().max(500).nullable().optional(),
  editorJson: z.record(z.string(), z.unknown()),
})

export type UpsertEmailTemplateInput = z.infer<typeof upsertEmailTemplateSchema>
