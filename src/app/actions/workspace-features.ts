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
