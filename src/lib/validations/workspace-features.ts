import { z } from 'zod'
import { postgresUuid } from '@/lib/validations/uuid'
export const featureTenantSchema = z.object({ type: z.enum(['partner', 'client']), id: postgresUuid() }).strict()
export const insightExperienceSchema = z.enum(['compare', 'individual', 'unified'])
export const featureSettingSchema = z.discriminatedUnion('key', [
  z.object({ key: z.literal('compare'), value: z.boolean() }).strict(),
  z.object({ key: z.literal('trajectory'), value: z.boolean() }).strict(),
  z.object({ key: z.literal('unifiedTrajectory'), value: z.boolean() }).strict(),
  z.object({ key: z.literal('dashboardStyle'), value: z.enum(['default', 'operational', 'portfolio']) }).strict(),
])
