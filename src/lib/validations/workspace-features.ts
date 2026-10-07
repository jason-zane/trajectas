import { z } from 'zod'
import { WORKSPACE_FEATURE_KEYS } from '@/lib/features/workspace-features'
import { postgresUuid } from '@/lib/validations/uuid'
export const featureTenantSchema = z.object({ type: z.enum(['partner', 'client']), id: postgresUuid() }).strict()
export const insightExperienceSchema = z.enum(['compare', 'individual', 'unified'])
export const featureSettingSchema = z.union([
  z.object({ key: z.enum(WORKSPACE_FEATURE_KEYS), value: z.boolean() }).strict(),
  z.object({ key: z.literal('dashboardStyle'), value: z.enum(['default', 'operational', 'portfolio']) }).strict(),
])
export const workspaceFeatureConfigurationSchema = z.object({
  ...Object.fromEntries(WORKSPACE_FEATURE_KEYS.map(key => [key, z.boolean()])),
  dashboardStyle: z.enum(['default', 'operational', 'portfolio']),
}).strict()
