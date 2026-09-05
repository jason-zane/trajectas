import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { IntegrationApiError } from '@/lib/integrations/errors'

const PARTICIPANT_CREDENTIAL_FIELDS = new Set(['accessToken', 'access_token', 'assessmentUrl', 'assessment_url'])

/** Remove bearer credentials from nested legacy response/event envelopes. */
export function redactIntegrationParticipantCredentials(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactIntegrationParticipantCredentials)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => !PARTICIPANT_CREDENTIAL_FIELDS.has(key))
    .map(([key, child]) => [key, redactIntegrationParticipantCredentials(child)]))
}

/** Re-evaluate current policy, including standard → aggregate-only changes
 * after an idempotent response or webhook was originally persisted. */
export async function protectIntegrationPayload(
  clientId: string, campaignId: string, payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await createAdminClient().from('campaigns')
    .select('confidentiality_mode').eq('id', campaignId).eq('client_id', clientId)
    .is('deleted_at', null).maybeSingle()
  if (error || !data) throw new IntegrationApiError(404, 'campaign_not_found', 'Campaign not found.')
  return data.confidentiality_mode === 'aggregate_only'
    ? redactIntegrationParticipantCredentials(payload) as Record<string, unknown>
    : payload
}
