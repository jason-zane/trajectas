import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'

export const retentionPolicyInput = z.object({
  name: z.string().trim().min(1).max(120),
  version: z.string().trim().min(1).max(80),
  scope: z.enum(['assessment','operations']),
  retentionMonths: z.number().int().min(1).max(120).nullable(),
  backupDays: z.number().int().min(1).max(365),
  diagnosticDays: z.number().int().min(1).max(365).nullable(),
  auditDays: z.number().int().min(1).max(3650).nullable(),
  researchAllowed: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.scope === 'assessment' && value.retentionMonths === null) context.addIssue({ code: 'custom', message: 'Choose an assessment retention period.' })
  if (value.scope === 'operations' && (value.diagnosticDays === null || value.auditDays === null)) context.addIssue({ code: 'custom', message: 'Choose diagnostic and audit retention periods.' })
})
export type RetentionPolicyInput = z.infer<typeof retentionPolicyInput>
export const privacyNoticeInput = z.object({
  version: z.string().trim().min(1).max(80),
  audience: z.enum(['participant','website']),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(40000),
  acknowledgementLabel: z.string().trim().min(1).max(500),
  researchLabel: z.string().max(1000),
  researchChoiceEnabled: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.researchChoiceEnabled && !value.researchLabel.trim()) context.addIssue({ code: 'custom', message: 'Describe the research choice.' })
})
export type PrivacyNoticeInput = z.infer<typeof privacyNoticeInput>
export const campaignPrivacyInput = z.object({
  campaignId: postgresUuid(),
  policyId: postgresUuid(),
  // Omission preserves the current notice; it never withdraws an assigned one.
  noticeId: postgresUuid().optional(),
  closedAt: z.iso.datetime({ offset: true }).nullable(),
}).strict()
export const privacyHoldInput = z.object({
  campaignId: postgresUuid(),
  participantId: postgresUuid().nullable(),
  reason: z.string().trim().min(1).max(1000),
  reviewAt: z.iso.datetime({ offset: true }),
}).strict()
