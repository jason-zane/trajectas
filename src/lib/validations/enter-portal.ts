import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'

export const logSupportSessionPageViewSchema = z.object({
  sessionId: postgresUuid(),
  actorId: postgresUuid(),
  path: z.string().min(1).max(2048),
})
export type LogSupportSessionPageViewInput = z.infer<typeof logSupportSessionPageViewSchema>

export const enterPortalLaunchUrlSchema = z.object({
  tenantType: z.enum(['client', 'partner']),
  tenantId: postgresUuid(),
})
export type EnterPortalLaunchUrlInput = z.infer<typeof enterPortalLaunchUrlSchema>

export const endSupportSessionSchema = z.object({
  sessionId: postgresUuid(),
})
export type EndSupportSessionInput = z.infer<typeof endSupportSessionSchema>
