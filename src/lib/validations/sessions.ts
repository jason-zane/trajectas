import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'

export const sessionIdSchema = z.object({
  sessionId: postgresUuid('Invalid session ID'),
})

export const bulkSessionIdsSchema = z.object({
  ids: z.array(postgresUuid('Invalid session ID')).max(1000, 'Too many sessions'),
})

export type SessionIdInput = z.infer<typeof sessionIdSchema>
export type BulkSessionIdsInput = z.infer<typeof bulkSessionIdsSchema>
