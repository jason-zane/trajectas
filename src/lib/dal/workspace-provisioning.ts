import 'server-only'
import { AuthorizationError, isUnconfinedPlatformAdmin, resolveAuthorizedScope } from '@/lib/auth/authorization'
import { createAdminClient } from '@/lib/supabase/admin'
import { workspaceFeatureConfigurationSchema } from '@/lib/validations/workspace-features'
import { validateWorkspaceFeatures, type FeatureTenant, type WorkspaceFeatures } from '@/lib/features/workspace-features'
import { workspacePreset, type WorkspacePresetId } from '@/lib/features/workspace-presets'

/** This platform-only path cannot be used to give partner administrators feature-selection rights. */
export async function provisionWorkspaceWithFeatures(type: FeatureTenant['type'], record: Record<string, unknown>, form: FormData): Promise<{ id: string }> {
  const scope = await resolveAuthorizedScope()
  if (scope.requestSurface !== 'admin' || !isUnconfinedPlatformAdmin(scope) || !scope.actor?.id) throw new AuthorizationError('Only unrestricted Trajectas administrators can select provisioning features.')
  const preset = String(form.get('featurePreset')) as WorkspacePresetId
  workspacePreset(preset, type) // validates tenant compatibility and immutable version
  const features = workspaceFeatureConfigurationSchema.parse(JSON.parse(String(form.get('featureConfiguration')))) as WorkspaceFeatures
  validateWorkspaceFeatures(features, type)
  const { data, error } = await createAdminClient().rpc('provision_workspace_with_features', {
    p_tenant_type: type, p_record: record, p_actor: scope.actor.id,
    p_features: features, p_origin: `preset:${preset}:v1:provisioning`,
  })
  if (error || !data) throw new Error('Unable to create workspace with its features.')
  return { id: String(data) }
}
