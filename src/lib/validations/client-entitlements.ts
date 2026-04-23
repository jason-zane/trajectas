import { z } from 'zod'
import { postgresUuid } from './uuid'

export const clientIdSchema = z.object({
  clientId: postgresUuid('Invalid client ID'),
})
export type ClientIdInput = z.infer<typeof clientIdSchema>

export const clientAssessmentDetailSchema = z.object({
  clientId: postgresUuid('Invalid client ID'),
  assessmentId: postgresUuid('Invalid assessment ID'),
})
export type ClientAssessmentDetailInput = z.infer<typeof clientAssessmentDetailSchema>

export const checkQuotaAvailabilitySchema = z.object({
  clientId: postgresUuid('Invalid client ID'),
  assessmentIds: z.array(postgresUuid('Invalid assessment ID')),
})
export type CheckQuotaAvailabilityInput = z.infer<typeof checkQuotaAvailabilitySchema>

export const assignAssessmentSchema = z.object({
  clientId: postgresUuid('Invalid client ID'),
  assessmentId: postgresUuid('Invalid assessment ID'),
  quotaLimit: z.number().int().min(0).nullable().optional(),
})
export type AssignAssessmentInput = z.infer<typeof assignAssessmentSchema>

export const updateAssessmentAssignmentSchema = z.object({
  assignmentId: postgresUuid('Invalid assignment ID'),
  clientId: postgresUuid('Invalid client ID'),
  quotaLimit: z.number().int().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
})
export type UpdateAssessmentAssignmentInput = z.infer<typeof updateAssessmentAssignmentSchema>

export const removeAssessmentAssignmentSchema = z.object({
  assignmentId: postgresUuid('Invalid assignment ID'),
  clientId: postgresUuid('Invalid client ID'),
})
export type RemoveAssessmentAssignmentInput = z.infer<typeof removeAssessmentAssignmentSchema>

export const toggleReportTemplateAssignmentSchema = z.object({
  clientId: postgresUuid('Invalid client ID'),
  reportTemplateId: postgresUuid('Invalid report template ID'),
  assigned: z.boolean(),
})
export type ToggleReportTemplateAssignmentInput = z.infer<typeof toggleReportTemplateAssignmentSchema>

export const toggleClientBrandingSchema = z.object({
  clientId: postgresUuid('Invalid client ID'),
  canCustomize: z.boolean(),
})
export type ToggleClientBrandingInput = z.infer<typeof toggleClientBrandingSchema>
