import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { finalizeCompletedSessionProcessing } from '@/lib/dal/session-processing'
import { logActionError } from '@/lib/security/action-errors'

export const SESSION_RECOVERY_BATCH = 5
export const SESSION_RECOVERY_STALE_MS = 10 * 60 * 1000
const PICKUP_BUDGET_MS = 30 * 1000

type RecoveryOptions = {
  client?: ReturnType<typeof createAdminClient>
  now?: Date
}

/** Recover accepted submissions even when their browser/worker has gone away.
 * The existing processing lease is the authority: overlapping cron runs and
 * participant retries cannot both run the scoring pipeline for one session.
 * Explicit failures remain visible for intervention instead of retrying forever.
 */
export async function recoverInterruptedSessionProcessing(options: RecoveryOptions = {}) {
  const db = options.client ?? createAdminClient()
  const cutoff = new Date((options.now ?? new Date()).getTime() - SESSION_RECOVERY_STALE_MS).toISOString()
  const deadline = Date.now() + PICKUP_BUDGET_MS
  const { data: sessions, error } = await db.from('participant_sessions')
    .select('id,campaign_id,campaign_participant_id,assessment_id,completed_at,campaign_participants!inner(campaign_rater_id,deleted_at,status),campaigns!inner(deleted_at)')
    .eq('status', 'completed')
    .in('processing_status', ['idle', 'scoring', 'scored'])
    .lt('completed_at', cutoff)
    .or(`processing_claimed_at.is.null,processing_claimed_at.lt.${cutoff}`)
    .is('campaign_participants.campaign_rater_id', null)
    .is('campaign_participants.deleted_at', null)
    .not('campaign_participants.status', 'in', '(withdrawn,expired)')
    .is('campaigns.deleted_at', null)
    .order('completed_at', { ascending: true })
    .limit(SESSION_RECOVERY_BATCH)
  if (error) throw new Error(`Unable to load interrupted assessment processing: ${error.message}`)

  let attempted = 0
  let failed = 0
  for (const session of sessions ?? []) {
    if (Date.now() >= deadline) break
    attempted += 1
    try {
      const result = await finalizeCompletedSessionProcessing({
        sessionId: session.id,
        campaignId: session.campaign_id,
        campaignParticipantId: session.campaign_participant_id,
        assessmentId: session.assessment_id,
        completedAt: session.completed_at!,
        emitAssessmentCompletedEvent: false,
        deferReportGeneration: true,
      })
      if (!result.ok) {
        failed += 1
        logActionError('sessionProcessing.recovery', result.message)
      }
    } catch (error) {
      failed += 1
      logActionError('sessionProcessing.recovery', error)
      // A crashed/throwing operation keeps its expiring lease; subsequent
      // cron runs may recover it, just as they recover a terminated worker.
    }
  }
  return { picked: sessions?.length ?? 0, attempted, failed }
}
