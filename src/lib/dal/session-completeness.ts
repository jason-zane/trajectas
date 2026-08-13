import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { logActionError } from '@/lib/security/action-errors'
import { getOrCreateSectionForms } from '@/lib/dal/session-forms'

type DbClient = SupabaseClient

/**
 * Compare the item set actually DELIVERED to this session against its saved
 * responses. Backs the hard completeness gate in submitSession: an
 * in-progress session may only be completed once every delivered item has a
 * response.
 *
 * "Delivered" (LR-3 / #333) now means the session's frozen
 * `participant_section_forms` rows, not a live recomputation of the runner's
 * selection pipeline. Before this, getSessionState and this module each kept
 * their own hand-written copy of the campaign-factor-filter +
 * selectItemsByDifficulty pipeline "in sync by hand" — a standing
 * correctness hazard: if the two ever drifted, the completeness gate would
 * desync from what the runner actually showed, and a participant could get
 * stuck (gate expects an item they were never shown) or submit early (gate
 * misses one they were). Both now call the SAME
 * src/lib/dal/session-forms.ts#getOrCreateSectionForms, so there is exactly
 * one implementation of "what was delivered" — this module can no longer
 * disagree with the runner because it no longer computes its own answer.
 *
 * getOrCreateSectionForms also freezes on demand: in the (expected-empty in
 * normal flow, since getSessionState always runs first) case where this is
 * reached before a section's form exists, it assembles and persists one
 * using the same freeze-on-next-read behaviour getSessionState relies on.
 *
 * Only delivered items count on either side — stale responses to removed or
 * unselected items neither help nor hurt.
 *
 * Server-authoritative timing (LR-2 / #332): an item delivered in a section
 * whose deadline has passed (participant_section_states.finalised_at is set,
 * or its deadline_at is in the past even if the sweep hasn't finalised it
 * yet) is dropped from `expected` when unanswered. Without this, a
 * participant who ran out of time would be permanently unable to submit —
 * the hard completeness gate below would refuse forever. An item in an
 * expired section that WAS answered still counts (on both sides) — expiry
 * excludes only the gap, never a real answer.
 */
export async function getSessionCompleteness(
  db: DbClient,
  input: {
    sessionId: string
    assessmentId: string | null
    campaignId: string | null
  },
): Promise<{ expected: number; answered: number } | { error: string }> {
  const { sessionId, assessmentId, campaignId } = input
  if (!assessmentId) {
    return { error: 'Unable to verify assessment completeness right now' }
  }

  const [formsResult, responsesResult, sectionStatesResult] = await Promise.all([
    getOrCreateSectionForms(db, { sessionId, assessmentId, campaignId }),
    db.from('participant_responses').select('item_id').eq('session_id', sessionId),
    db
      .from('participant_section_states')
      .select('section_id, deadline_at, finalised_at')
      .eq('session_id', sessionId),
  ])

  if ('error' in formsResult) {
    return { error: formsResult.error }
  }
  if (responsesResult.error) {
    logActionError('sessionCompleteness.responses', responsesResult.error)
    return { error: 'Unable to verify assessment completeness right now' }
  }
  if (sectionStatesResult.error) {
    logActionError('sessionCompleteness.sectionStates', sectionStatesResult.error)
    return { error: 'Unable to verify assessment completeness right now' }
  }

  const now = new Date()
  const expiredSectionIds = new Set(
    (sectionStatesResult.data ?? [])
      .filter(
        (row) =>
          row.finalised_at != null ||
          (row.deadline_at != null && new Date(row.deadline_at) < now),
      )
      .map((row) => String(row.section_id)),
  )

  const answeredIds = new Set(
    (responsesResult.data ?? []).map((row) => String(row.item_id)),
  )

  let expected = 0
  let answered = 0
  for (const [sectionId, form] of formsResult) {
    const sectionExpired = expiredSectionIds.has(sectionId)
    for (const entry of form.entries) {
      const isAnswered = answeredIds.has(entry.itemId)
      // Drop unanswered items whose section has expired — see the function
      // docstring. Items already answered stay counted either way.
      if (sectionExpired && !isAnswered) continue
      expected++
      if (isAnswered) answered++
    }
  }

  return { expected, answered }
}
