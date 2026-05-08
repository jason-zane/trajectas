import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'

const campaignParticipantStatus = z.enum([
  'invited',
  'registered',
  'in_progress',
  'completed',
  'withdrawn',
  'expired',
])

export const getParticipantsFiltersSchema = z.object({
  status: campaignParticipantStatus.optional(),
  campaignId: postgresUuid().optional(),
  search: z.string().max(200).optional(),
  page: z.number().int().min(1).optional(),
  perPage: z.number().int().min(1).max(200).optional(),
})
export type GetParticipantsFiltersInput = z.infer<typeof getParticipantsFiltersSchema>

export const getUniqueParticipantsFiltersSchema = z.object({
  status: campaignParticipantStatus.optional(),
  search: z.string().max(200).optional(),
  page: z.number().int().min(1).optional(),
  perPage: z.number().int().min(1).max(200).optional(),
})
export type GetUniqueParticipantsFiltersInput = z.infer<typeof getUniqueParticipantsFiltersSchema>

export const bulkParticipantIdsSchema = z.object({
  ids: z.array(postgresUuid()).min(1),
})
export type BulkParticipantIdsInput = z.infer<typeof bulkParticipantIdsSchema>

export const bulkUpdateParticipantStatusSchema = z.object({
  ids: z.array(postgresUuid()).min(1),
  status: campaignParticipantStatus,
})
export type BulkUpdateParticipantStatusInput = z.infer<typeof bulkUpdateParticipantStatusSchema>
