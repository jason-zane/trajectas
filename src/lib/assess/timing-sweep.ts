import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Section-timing sweep (LR-2 / #332).
 *
 * Durable safety net for section finalisation. The primary path is the
 * client-side SectionTimer calling finaliseSection(..., 'client_timer') the
 * moment the server-issued deadline is reached — but that requires the
 * participant's tab to still be open. A closed tab, a crashed browser, or a
 * device that goes offline right at the deadline leaves the section's
 * participant_section_states row open (deadline_at in the past,
 * finalised_at still NULL) forever. This sweep finds those and finalises
 * them, so:
 *   - the completeness gate (getSessionCompleteness) can correctly exclude
 *     the section's unanswered items once the participant DOES return
 *     (whether via the sweep's finalised_at or a live deadline_at check —
 *     see the DAL docstring, both are honoured), and
 *   - participant_section_states stops reporting a "live" deadline for a
 *     section nobody is actively taking.
 *
 * Deliberately scoped to section-level finalisation only. It does NOT drive
 * full session completion (scoring / report generation) for an abandoned
 * session — that requires the same access-token-gated machinery submitSession
 * uses (src/app/actions/assess.ts:finalizeCompletedSessionProcessing), which
 * doesn't have a service-role-safe entry point today. A participant who
 * returns after their sections are swept can still submit normally (the
 * completeness gate now excludes the expired gaps); a participant who never
 * returns stays 'in_progress' with no score, the same as any other abandoned
 * (untimed) assessment today. Extending the sweep to drive full completion
 * for abandoned sessions is a reasonable follow-up, not done here.
 *
 * Driven by the /api/cron/assessment-timing-sweep cron (every 5 minutes),
 * modelled on src/lib/reports/generation-sweep.ts.
 */

/**
 * How long past its deadline a section must sit unfinalised before the
 * sweep treats it as abandoned, matching
 * docs/superpowers/specs/2026-08-13-logical-reasoning-build-plan/
 * 02-platform-architecture.md §3.3. Comfortably longer than the largest
 * grace_seconds (120s) and the save queue's retry backoff, so the sweep
 * never races a legitimately-still-connecting client.
 */
export const SECTION_TIMING_SWEEP_STALE_MS = 10 * 60 * 1000

export interface TimingSweepResult {
  scanned: number
  finalised: number
}

type AdminClient = ReturnType<typeof createAdminClient>

interface OpenSectionStateRow {
  session_id: string
  section_id: string
  deadline_at: string
}

export async function sweepAssessmentTiming(
  opts: { now?: Date; client?: AdminClient } = {},
): Promise<TimingSweepResult> {
  const db = opts.client ?? createAdminClient()
  const now = opts.now ?? new Date()
  const cutoffIso = new Date(now.getTime() - SECTION_TIMING_SWEEP_STALE_MS).toISOString()

  const { data: rows, error } = await db
    .from('participant_section_states')
    .select('session_id, section_id, deadline_at')
    .is('finalised_at', null)
    .not('deadline_at', 'is', null)
    .lt('deadline_at', cutoffIso)

  if (error) {
    console.error('[assess] timing sweep failed to list abandoned sections:', error)
    return { scanned: 0, finalised: 0 }
  }

  let finalised = 0
  for (const row of (rows ?? []) as OpenSectionStateRow[]) {
    // Race-guarded: .is('finalised_at', null) on the UPDATE means a section
    // finalised (by the participant or the client-timer path) between the
    // SELECT above and this UPDATE is left untouched — count reflects rows
    // this sweep actually changed, not rows it merely looked at.
    const { error: updateError, count } = await db
      .from('participant_section_states')
      .update(
        {
          expired_at: row.deadline_at,
          finalised_at: now.toISOString(),
          finalised_by: 'sweep',
        },
        { count: 'exact' },
      )
      .eq('session_id', row.session_id)
      .eq('section_id', row.section_id)
      .is('finalised_at', null)

    if (updateError) {
      console.error('[assess] timing sweep failed to finalise section:', row, updateError)
      continue
    }
    finalised += count ?? 0
  }

  return { scanned: (rows ?? []).length, finalised }
}
