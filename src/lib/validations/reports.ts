import { z } from 'zod'
import { postgresUuid } from './uuid'

export const createReportTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional(),
  reportType: z.enum(['self_report', '360']),
  displayLevel: z.enum(['dimension', 'factor', 'construct']),
  groupByDimension: z.boolean().optional(),
  personReference: z.enum(['you', 'first_name', 'participant', 'the_participant', 'neutral']).optional(),
  pageHeaderLogo: z.enum(['primary', 'secondary', 'none']).optional(),
  partnerId: postgresUuid().optional(),
})
export type CreateReportTemplateValidatedInput = z.infer<typeof createReportTemplateSchema>

export const updateReportTemplateSettingsSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  reportType: z.enum(['self_report', '360']).optional(),
  displayLevel: z.enum(['dimension', 'factor', 'construct']).optional(),
  groupByDimension: z.boolean().optional(),
  personReference: z.enum(['you', 'first_name', 'participant', 'the_participant', 'neutral']).optional(),
  pageHeaderLogo: z.enum(['primary', 'secondary', 'none']).optional(),
})
export type UpdateReportTemplateSettingsInput = z.infer<typeof updateReportTemplateSettingsSchema>

export const updateReportTemplateBlocksSchema = z.object({
  id: postgresUuid(),
  blocks: z.array(z.record(z.string(), z.unknown())),
})
export type UpdateReportTemplateBlocksInput = z.infer<typeof updateReportTemplateBlocksSchema>

export const campaignTemplateSchema = z.object({
  campaignId: postgresUuid(),
  templateId: postgresUuid(),
})
export type CampaignTemplateInput = z.infer<typeof campaignTemplateSchema>

export const sendReportSnapshotEmailSchema = z.object({
  snapshotId: postgresUuid(),
  body: z.string().min(1, 'Email body is required').max(10000),
})
export type SendReportSnapshotEmailInput = z.infer<typeof sendReportSnapshotEmailSchema>

export const getAllReadySnapshotsSchema = z.object({
  limit: z.number().int().min(1).max(5000).optional(),
})
export type GetAllReadySnapshotsInput = z.infer<typeof getAllReadySnapshotsSchema>

export const bulkReportIdsSchema = z.object({
  ids: z.array(postgresUuid()).min(1),
})
export type BulkReportIdsInput = z.infer<typeof bulkReportIdsSchema>

export const bulkSetReportTemplateActiveSchema = z.object({
  ids: z.array(postgresUuid()).min(1),
  active: z.boolean(),
})
export type BulkSetReportTemplateActiveInput = z.infer<typeof bulkSetReportTemplateActiveSchema>

export const bulkUpdateReportStatusSchema = z.object({
  ids: z.array(postgresUuid()).min(1),
  status: z.enum(['pending', 'generating', 'ready', 'released', 'failed']),
})
export type BulkUpdateReportStatusInput = z.infer<typeof bulkUpdateReportStatusSchema>
