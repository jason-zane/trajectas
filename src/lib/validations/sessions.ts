import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'

export const sessionIdSchema = z.object({
  sessionId: postgresUuid(),
})
export type SessionIdInput = z.infer<typeof sessionIdSchema>

export const bulkSessionIdsSchema = z.object({
  ids: z.array(postgresUuid()).min(1),
})
export type BulkSessionIdsInput = z.infer<typeof bulkSessionIdsSchema>
