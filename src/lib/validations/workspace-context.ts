import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'

export const setActiveWorkspaceContextSchema = z.object({
  surface: z.enum(['admin', 'partner', 'client']),
  tenantType: z.enum(['partner', 'client']).optional(),
  tenantId: postgresUuid().optional(),
  membershipId: postgresUuid().optional(),
})

export const startAuditedSupportLaunchSchema = z.object({
  targetSurface: z.enum(['partner', 'client']),
  targetTenantId: postgresUuid(),
  reason: z.string().min(1).max(500),
})

export type SetActiveWorkspaceContextInput = z.infer<typeof setActiveWorkspaceContextSchema>
export type StartAuditedSupportLaunchInput = z.infer<typeof startAuditedSupportLaunchSchema>
