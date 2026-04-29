import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'

export const getSessionsForMatchingSelectSchema = z.object({
  clientId: postgresUuid().optional(),
})

export const bulkDeleteMatchingRunsSchema = z.object({
  ids: z.array(postgresUuid()).min(1),
})

export type GetSessionsForMatchingSelectInput = z.infer<typeof getSessionsForMatchingSelectSchema>
export type BulkDeleteMatchingRunsInput = z.infer<typeof bulkDeleteMatchingRunsSchema>
