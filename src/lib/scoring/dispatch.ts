/**
 * Scoring dispatcher (LR-5 / #335) — routes a completed session to the
 * scorer named by its assessment's `scoring_profile`.
 *
 * Called from `finalizeCompletedSessionProcessing` in
 * src/app/actions/assess.ts, exactly where `scoreSessionCTT(sessionId)` was
 * called directly before this change. Every other step of the submit state
 * machine (scoring -> scored -> reporting/ready transitions,
 * markParticipantSessionProcessing, the report-snapshot fan-out, token
 * rotation) is unchanged.
 *
 * `scoring_profile` defaults to `'pomp_factor'` for every assessment
 * (20260813104000_cognitive_scoring.sql), so every existing assessment
 * keeps routing to `scoreSessionCTT` with byte-identical behaviour — this
 * is the hard regression gate the issue calls out, verified by
 * tests/integration/scoring-dispatch.test.ts and the existing
 * ctt-session*.test.ts suite, which is untouched by this change.
 *
 * Why dispatch on the new `scoring_profile` enum rather than the existing
 * `assessments.scoring_method` (`irt|ctt|hybrid`): every assessment today
 * is `scoring_method = 'ctt'`, and ability sum-correct scoring is *also*
 * CTT (see ability-session.ts's own scoring_method='ctt' write) — the two
 * profiles are indistinguishable on that column without retro-fitting
 * meaning onto existing rows. `scoring_method` remains the psychometric-
 * model label (what each scorer writes to participant_scores.scoring_method);
 * `scoring_profile` is purely a dispatch key.
 *
 * @module
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { scoreSessionCTT } from '@/lib/scoring/ctt-session'
import { scoreSessionAbility } from '@/lib/scoring/ability-session'
import { scoreSessionAbilityIRT } from '@/lib/scoring/ability-irt-session'

export type ScoreSessionResult = { success: true; scoreCount: number } | { error: string }

export async function scoreSession(sessionId: string): Promise<ScoreSessionResult> {
  const db = createAdminClient()

  const { data: session, error: sessionErr } = await db
    .from('participant_sessions')
    .select('assessment_id')
    .eq('id', sessionId)
    .single()
  if (sessionErr || !session) {
    return { error: sessionErr?.message ?? 'Session not found' }
  }

  const { data: assessment, error: assessmentErr } = await db
    .from('assessments')
    .select('scoring_profile')
    .eq('id', session.assessment_id as string)
    .single()
  if (assessmentErr || !assessment) {
    return { error: assessmentErr?.message ?? 'Assessment not found' }
  }

  const profile = (assessment.scoring_profile as string | null) ?? 'pomp_factor'

  switch (profile) {
    case 'pomp_factor':
      return scoreSessionCTT(sessionId)
    case 'ability_dichotomous':
      return scoreSessionAbility(sessionId)
    case 'ability_irt':
      return scoreSessionAbilityIRT(sessionId)
    default:
      return { error: `Unknown scoring profile: ${profile}` }
  }
}
