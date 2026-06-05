/**
 * Assessment resume-reminder sweep.
 *
 * Finds in-progress participant sessions that have gone quiet and nudges the
 * participant with a "pick up where you left off" email (the existing
 * `assessment_reminder` template, whose "Continue Assessment" button points
 * back at their tokenised runner URL).
 *
 * Two tiers, at most two emails per session:
 *   Tier 1 — first nudge after TIER1_INACTIVITY_MS of inactivity.
 *   Tier 2 — second nudge TIER2_DELAY_MS after Tier 1, if still in_progress.
 *
 * Driven by the /api/cron/assessment-resume-reminders cron. The selection
 * relies on participant_sessions.last_activity_at (kept fresh by the
 * participant_responses activity trigger) and the resume_reminder_count /
 * resume_reminder_last_sent_at bookkeeping columns — see migration
 * 20260605120000_assessment_resume_reminders.sql.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAppUrl } from '@/lib/hosts'
import type { sendEmail } from '@/lib/email/send'

const DAY_MS = 24 * 60 * 60 * 1000

/** Inactivity before the first nudge. Roughly "5 minutes since last answer". */
export const TIER1_INACTIVITY_MS = 5 * 60 * 1000
/** Delay between the first and second (final) nudge. */
export const TIER2_DELAY_MS = DAY_MS
/** Safety cap per run so a backlog is drained over several invocations. */
const MAX_PER_RUN = 200

type AdminClient = ReturnType<typeof createAdminClient>
type SendEmailFn = typeof sendEmail

export interface SweepResult {
  tier1Sent: number
  tier2Sent: number
  errors: number
}

interface DueSession {
  id: string
  campaign_id: string | null
  campaign_participant_id: string
}

export interface SweepOptions {
  /** Override "now" — used by tests. */
  now?: Date
  /** Inject a Supabase admin client — used by tests. */
  client?: AdminClient
  /** Inject the email sender — used by tests to avoid real delivery. */
  sendFn?: SendEmailFn
}

export async function sweepResumeReminders(
  opts: SweepOptions = {},
): Promise<SweepResult> {
  const db = opts.client ?? createAdminClient()
  // Lazy-load the email module only when a sender is not injected, so test
  // callers passing `sendFn` never pull in the server-only email/brand chain.
  const send: SendEmailFn =
    opts.sendFn ?? (await import('@/lib/email/send')).sendEmail
  const now = opts.now ?? new Date()

  const tier1Cutoff = new Date(now.getTime() - TIER1_INACTIVITY_MS).toISOString()
  const tier2Cutoff = new Date(now.getTime() - TIER2_DELAY_MS).toISOString()

  // Tier 1: never reminded, quiet for long enough.
  const { data: tier1Rows, error: t1err } = await db
    .from('participant_sessions')
    .select('id, campaign_id, campaign_participant_id')
    .eq('status', 'in_progress')
    .eq('resume_reminder_count', 0)
    .not('campaign_participant_id', 'is', null)
    .lte('last_activity_at', tier1Cutoff)
    .limit(MAX_PER_RUN)
  if (t1err) throw new Error(`tier1 query failed: ${t1err.message}`)

  // Tier 2: reminded once, 24h elapsed since, still unfinished.
  const { data: tier2Rows, error: t2err } = await db
    .from('participant_sessions')
    .select('id, campaign_id, campaign_participant_id')
    .eq('status', 'in_progress')
    .eq('resume_reminder_count', 1)
    .not('campaign_participant_id', 'is', null)
    .lte('resume_reminder_last_sent_at', tier2Cutoff)
    .limit(MAX_PER_RUN)
  if (t2err) throw new Error(`tier2 query failed: ${t2err.message}`)

  const tier1 = await sendForTier(db, send, now, (tier1Rows ?? []) as DueSession[], 1)
  const tier2 = await sendForTier(db, send, now, (tier2Rows ?? []) as DueSession[], 2)

  return {
    tier1Sent: tier1.sent,
    tier2Sent: tier2.sent,
    errors: tier1.errors + tier2.errors,
  }
}

async function sendForTier(
  db: AdminClient,
  send: SendEmailFn,
  now: Date,
  rows: DueSession[],
  tier: 1 | 2,
): Promise<{ sent: number; errors: number }> {
  let sent = 0
  let errors = 0
  if (rows.length === 0) return { sent, errors }

  const participantIds = [...new Set(rows.map((r) => r.campaign_participant_id))]
  const campaignIds = [
    ...new Set(rows.map((r) => r.campaign_id).filter((id): id is string => Boolean(id))),
  ]

  const [participantsRes, campaignsRes] = await Promise.all([
    db
      .from('campaign_participants')
      .select('id, email, first_name, access_token, deleted_at')
      .in('id', participantIds),
    campaignIds.length
      ? db
          .from('campaigns')
          .select('id, title, client_id, partner_id, closes_at, deleted_at')
          .in('id', campaignIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  // Abort the tier on a lookup failure rather than treating every selected
  // session as unsendable — otherwise a transient DB/API error would burn a
  // reminder tier for the whole batch with no email and no retry.
  if (participantsRes.error)
    throw new Error(`participant lookup failed: ${participantsRes.error.message}`)
  if (campaignsRes.error)
    throw new Error(`campaign lookup failed: ${campaignsRes.error.message}`)

  const participants = new Map(
    (participantsRes.data ?? []).map((p) => [p.id as string, p]),
  )
  const campaigns = new Map((campaignsRes.data ?? []).map((c) => [c.id as string, c]))
  const baseUrl = requireAppUrl('public')

  for (const row of rows) {
    // Claim the row atomically *before* sending: advance the counter only if
    // it's still in_progress, still on the prior tier, and still past this
    // tier's cutoff. This wins exactly one claim across overlapping runs (no
    // double-send) and drops a session that became active again between
    // selection and now (the activity trigger moved last_activity_at).
    const claimed = await claimSession(db, row, tier, now)
    if (!claimed) continue

    const participant = participants.get(row.campaign_participant_id)
    const campaign = row.campaign_id ? campaigns.get(row.campaign_id) : undefined

    // Not a valid send target — leave it claimed so we don't reselect this row
    // on every subsequent run. Skip when:
    //  - the participant is gone / has no deliverable token,
    //  - the campaign is missing,
    //  - the campaign is soft-deleted, or
    //  - the campaign has already closed (no point nudging someone to finish an
    //    assessment that no longer accepts responses).
    const campaignClosed =
      !!campaign?.closes_at && new Date(campaign.closes_at).getTime() <= now.getTime()
    if (
      !participant ||
      participant.deleted_at ||
      !participant.email ||
      !participant.access_token ||
      !campaign ||
      campaign.deleted_at ||
      campaignClosed
    ) {
      continue
    }

    try {
      await send({
        type: 'assessment_reminder',
        to: participant.email,
        variables: {
          participantFirstName: participant.first_name ?? '',
          campaignTitle: campaign.title,
          assessmentUrl: `${baseUrl}/assess/${participant.access_token}`,
          brandName: 'Trajectas',
          daysRemaining: daysRemaining(campaign.closes_at, now),
        },
        scopeCampaignId: row.campaign_id ?? undefined,
        scopeClientId: campaign.client_id ?? undefined,
        scopePartnerId: campaign.partner_id ?? undefined,
      })
      sent++
    } catch (err) {
      // At-most-once: the row is already claimed, and we deliberately do NOT
      // revert. A reminder is best-effort, and reverting would let a
      // permanently-undeliverable recipient (hard bounce, dead domain) loop
      // through this cron every few minutes forever. A missed tier-1 is still
      // covered by tier-2.
      console.error(
        `[cron:assessment-resume-reminders] tier ${tier} send failed for session ${row.id}:`,
        err instanceof Error ? err.message : String(err),
      )
      errors++
    }
  }

  return { sent, errors }
}

/**
 * Atomically advance a session's reminder counter, re-checking everything the
 * selection relied on (in_progress, prior tier, this tier's cutoff). Returns
 * whether this call won the claim.
 */
async function claimSession(
  db: AdminClient,
  row: DueSession,
  tier: 1 | 2,
  now: Date,
): Promise<boolean> {
  let query = db
    .from('participant_sessions')
    .update({
      resume_reminder_count: tier,
      resume_reminder_last_sent_at: now.toISOString(),
    })
    .eq('id', row.id)
    .eq('status', 'in_progress')
    .eq('resume_reminder_count', tier - 1)

  if (tier === 1) {
    query = query.lte(
      'last_activity_at',
      new Date(now.getTime() - TIER1_INACTIVITY_MS).toISOString(),
    )
  } else {
    query = query.lte(
      'resume_reminder_last_sent_at',
      new Date(now.getTime() - TIER2_DELAY_MS).toISOString(),
    )
  }

  const { data, error } = await query.select('id')
  if (error) {
    console.error(
      `[cron:assessment-resume-reminders] failed to claim session ${row.id}:`,
      error.message,
    )
    return false
  }
  return (data?.length ?? 0) > 0
}

function daysRemaining(closesAt: string | null, now: Date): string {
  if (!closesAt) return 'a few'
  const ms = new Date(closesAt).getTime() - now.getTime()
  if (!Number.isFinite(ms) || ms <= 0) return '0'
  return String(Math.ceil(ms / DAY_MS))
}
