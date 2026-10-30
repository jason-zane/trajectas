import 'server-only'

import type { createAdminClient } from '@/lib/supabase/admin'
import type { ParticipantRuntimeAccess } from '@/lib/auth/participant-runtime'
import { logActionError } from '@/lib/security/action-errors'

/** Called only after token/campaign/assessment authorisation. Each read must
 * reach Postgres: React GET memoization can otherwise reuse the pre-insert
 * empty response when a concurrent request wins the unique session insert. */
export function findResumableParticipantSession(
  db: ReturnType<typeof createAdminClient>,
  access: ParticipantRuntimeAccess,
  assessmentId: string,
) {
  return db.from('participant_sessions').select('id, client_id')
    .eq('campaign_id', access.campaignId)
    .eq('campaign_participant_id', access.participantId)
    .eq('assessment_id', assessmentId)
    .in('status', ['not_started', 'in_progress', 'completed'])
    .abortSignal(new AbortController().signal)
    .maybeSingle()
}

// Called only after the token/campaign/assessment gate in startSession.
export async function restoreMissingSessionClient(
  db: ReturnType<typeof createAdminClient>,
  session: { id: string; client_id: string | null },
  access: ParticipantRuntimeAccess,
): Promise<boolean> {
  if (!access.clientId || session.client_id !== null) return true
  // Legacy token sessions omitted the owner. Heal only that missing value after
  // token/campaign/assessment authorization; never overwrite an existing owner.
  const { error } = await db.from('participant_sessions')
    .update({ client_id: access.clientId })
    .eq('id', session.id)
    .eq('campaign_id', access.campaignId)
    .eq('campaign_participant_id', access.participantId)
    .is('client_id', null)
  if (error) {
    logActionError('startSession.restoreClient', error)
    return false
  }
  return true
}

