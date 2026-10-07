import 'server-only'
import { getIntegrationClientFeatures } from '@/lib/dal/workspace-features'
import { IntegrationApiError } from '@/lib/integrations/errors'
import type { WorkspaceFeature } from '@/lib/features/workspace-features'
/** Integration caller retains its authenticated client and existing scopes. */
export async function requireIntegrationClientFeature(clientId: string, ...features: WorkspaceFeature[]) {
  const config = await getIntegrationClientFeatures(clientId)
  if (features.some(feature => !config[feature])) throw new IntegrationApiError(403, 'workspace_feature_disabled', 'New integration delivery is not enabled for this client.')
}
