'use server'
import { revalidatePath } from 'next/cache'
import { AuthorizationError, requireAdminScope, isUnconfinedPlatformAdmin } from '@/lib/auth/authorization'
import { setTenantWorkspaceFeature } from '@/lib/dal/workspace-features'
import { featureTenantSchema, featureSettingSchema } from '@/lib/validations/workspace-features'
import { logActionError } from '@/lib/security/action-errors'
import type { WorkspaceFeatures } from '@/lib/features/workspace-features'
export async function updateWorkspaceFeature(tenantInput: unknown, settingInput: unknown): Promise<{ features: WorkspaceFeatures } | { error: string }> {
  const tenant = featureTenantSchema.safeParse(tenantInput)
  const setting = featureSettingSchema.safeParse(settingInput)
  if (!tenant.success || !setting.success) return { error: 'Invalid feature settings.' }
  try {
    const scope = await requireAdminScope()
    if (scope.requestSurface !== 'admin' || !isUnconfinedPlatformAdmin(scope)) throw new AuthorizationError('Return to the Trajectas admin portal to configure features.')
    // The DAL requires an unconfined Trajectas administrator and validates the tenant.
    const features = await setTenantWorkspaceFeature(tenant.data, setting.data)
    revalidatePath('/', 'layout')
    return { features }
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message }
    logActionError('updateWorkspaceFeature', error)
    return { error: 'Unable to update workspace features.' }
  }
}

export async function applyWorkspaceFeatureChange(tenantInput: unknown, expectedInput: unknown, changeInput: unknown): Promise<{ features: WorkspaceFeatures } | { error: string }> {
  try {
    const tenant = featureTenantSchema.parse(tenantInput)
    const { workspaceFeatureConfigurationSchema } = await import('@/lib/validations/workspace-features')
    const expected = workspaceFeatureConfigurationSchema.parse(expectedInput) as WorkspaceFeatures
    const { z } = await import('zod')
    const change = z.union([
      z.object({ preset: z.enum(['client', 'partnerStarter', 'fullPartner']) }).strict(),
      featureSettingSchema,
    ]).parse(changeInput)
    const scope = await requireAdminScope()
    if (scope.requestSurface !== 'admin' || !isUnconfinedPlatformAdmin(scope)) throw new AuthorizationError('Return to the Trajectas admin portal to configure features.')
    const { previewFeatureChange } = await import('@/lib/features/workspace-features')
    const { workspacePreset } = await import('@/lib/features/workspace-presets')
    const { applyWorkspaceFeatureConfiguration } = await import('@/lib/dal/workspace-features')
    const next = 'preset' in change ? workspacePreset(change.preset, tenant.type) : previewFeatureChange(expected, change.key, change.value, true)
    const origin = 'preset' in change ? `preset:${change.preset}:v1` as const : 'dependency'
    const features = await applyWorkspaceFeatureConfiguration(tenant, next, expected, origin)
    revalidatePath('/', 'layout')
    return { features }
  } catch (error) {
    if (error instanceof Error) return { error: error.message }
    return { error: 'Unable to update workspace features.' }
  }
}

export async function authorizeWorkspaceExport(experienceInput: unknown, formatInput: unknown): Promise<{ success: true } | { error: string }> {
  try {
    const { insightExperienceSchema } = await import('@/lib/validations/workspace-features')
    const { requireInsightExperience, requireWorkspaceFeature } = await import('@/lib/features/access')
    const experience = insightExperienceSchema.parse(experienceInput)
    if (formatInput !== 'csv' && formatInput !== 'pdf') return { error: 'Invalid export format.' }
    await requireInsightExperience(experience)
    await requireWorkspaceFeature(formatInput === 'csv' ? 'insightCsvExport' : 'reportDownload')
    return { success: true }
  } catch (error) { return { error: error instanceof Error ? error.message : 'Unable to authorise export.' } }
}

/** Recheck availability for an already rendered, previously authorised usage DTO. */
export async function authorizeWorkspaceUsageExport(): Promise<{ success: true } | { error: string }> {
  try {
    const { requireWorkspaceFeature } = await import('@/lib/features/access')
    await requireWorkspaceFeature('usageVisibility')
    return { success: true }
  } catch (error) { return { error: error instanceof Error ? error.message : 'Unable to authorise export.' } }
}
