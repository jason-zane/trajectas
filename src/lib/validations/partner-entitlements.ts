import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'

export const partnerIdSchema = z.object({
  partnerId: postgresUuid(),
})

export const assignAssessmentToPartnerSchema = z.object({
  partnerId: postgresUuid(),
  assessmentId: postgresUuid(),
  quotaLimit: z.number().int().nullable().optional(),
})

export const updatePartnerAssessmentAssignmentSchema = z.object({
  assignmentId: postgresUuid(),
  partnerId: postgresUuid(),
  quotaLimit: z.number().int().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const removePartnerAssessmentAssignmentSchema = z.object({
  assignmentId: postgresUuid(),
  partnerId: postgresUuid(),
})

export const togglePartnerReportTemplateAssignmentSchema = z.object({
  partnerId: postgresUuid(),
  reportTemplateId: postgresUuid(),
  assigned: z.boolean(),
})

export const togglePartnerBrandingSchema = z.object({
  partnerId: postgresUuid(),
  canCustomize: z.boolean(),
})

export type AssignAssessmentToPartnerInput = z.infer<typeof assignAssessmentToPartnerSchema>
export type UpdatePartnerAssessmentAssignmentInput = z.infer<typeof updatePartnerAssessmentAssignmentSchema>
export type TogglePartnerReportTemplateAssignmentInput = z.infer<typeof togglePartnerReportTemplateAssignmentSchema>
export type TogglePartnerBrandingInput = z.infer<typeof togglePartnerBrandingSchema>
