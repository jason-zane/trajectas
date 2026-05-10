import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'

export const logSupportSessionPageViewSchema = z.object({
  sessionId: postgresUuid('Invalid session ID'),
  actorId: postgresUuid('Invalid actor ID'),
  path: z.string().min(1).max(2048),
})

export const createEnterPortalLaunchUrlSchema = z.object({
  tenantType: z.enum(['client', 'partner']),
  tenantId: postgresUuid('Invalid tenant ID'),
})

export const endSupportSessionSchema = z.object({
  sessionId: postgresUuid('Invalid session ID'),
})

export type LogSupportSessionPageViewInput = z.infer<typeof logSupportSessionPageViewSchema>
export type CreateEnterPortalLaunchUrlInput = z.infer<typeof createEnterPortalLaunchUrlSchema>
export type EndSupportSessionInput = z.infer<typeof endSupportSessionSchema>
