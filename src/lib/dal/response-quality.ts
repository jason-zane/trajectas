import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSessionAccess, canManageCampaign, assertIndividualResultsAccess } from '@/lib/auth/authorization'
import { requireParticipantRuntimeSessionAccess } from '@/lib/auth/participant-runtime'
import { IPIP_DATABASE } from '@/lib/instrument/ipip-neo-120/database-form'
import { IPIP_ITEMS } from '@/lib/instrument/ipip-neo-120/definition'
import { QUALITY_MODULE_VERSION, QUALITY_POLICY_VERSION, QUALITY_QUESTIONS, type QualityModuleForRunner, type QualityReviewDecision, type QualityStatus, type ResponseQualityDetail, type ResponseQualityResult } from '@/lib/instrument/ipip-neo-120/response-quality'
import { analyseResponseQuality } from '@/lib/scoring/response-quality'

/** Internal boundary; caller has already authorised participant access or scoring. */
export async function readResponseQualityModule(db: SupabaseClient, sessionId: string): Promise<QualityModuleForRunner | null> {
  const { data, error } = await db.from('session_response_quality_modules').select('module_version,questions,answers,revision').eq('session_id', sessionId).maybeSingle()
  if (error) throw new Error('Unable to load supplementary questions')
  if (!data) return null
  const questions = data.questions as { id: string; stem: string }[]
  // jsonb key order is not preserved; field values and array order are frozen.
  if (data.module_version !== QUALITY_MODULE_VERSION || !Array.isArray(questions) || questions.length !== QUALITY_QUESTIONS.length ||
    QUALITY_QUESTIONS.some((question, i) => question.id !== questions[i]?.id || question.stem !== questions[i]?.stem)) throw new Error('Unsupported supplementary question version')
  return { version: QUALITY_MODULE_VERSION, questions: questions.map(q => ({ id: q.id, stem: q.stem })), answers: data.answers as Record<string, number>, revision: Number(data.revision) }
}

export async function getParticipantQualityModule(token: string, sessionId: string) {
  await requireParticipantRuntimeSessionAccess(token, sessionId)
  return readResponseQualityModule(createAdminClient(), sessionId)
}

export async function saveParticipantQualityAnswer(input: { token: string; sessionId: string; questionId: string; value: number; revision: number }) {
  await requireParticipantRuntimeSessionAccess(input.token, input.sessionId)
  const db = createAdminClient()
  const { data, error } = await db.rpc('save_response_quality_answer', { p_session_id: input.sessionId, p_question_id: input.questionId, p_value: input.value, p_expected_revision: input.revision })
  if (error) throw new Error(error.code === 'PT409' ? 'Your answers changed in another tab. Refresh this page before continuing.' : 'Your answer could not be saved. Please try again.')
  return data as { answers: Record<string, number>; revision: number }
}

export function isQualityModuleComplete(module: QualityModuleForRunner | null): boolean {
  return !module || module.questions.every(q => Number.isInteger(module.answers[q.id]) && module.answers[q.id] >= 1 && module.answers[q.id] <= 5)
}

/** Internal completion dispatcher only. Immutable, conflict-ignoring writes make
 * duplicate completions converge; old attempts without a supplement remain so.
 */
export async function persistSessionResponseQuality(db: SupabaseClient, sessionId: string) {
  const { data: existing, error: existingError } = await db.from('participant_response_quality_results').select('id').eq('session_id', sessionId).eq('policy_version', QUALITY_POLICY_VERSION).maybeSingle()
  if (existingError) throw new Error('Unable to inspect response-quality processing')
  if (existing) return
  const supplement = await readResponseQualityModule(db, sessionId)
  const { data: rows, error } = await db.from('participant_responses').select('item_id,section_id,response_value,response_time_ms').eq('session_id', sessionId)
  if (error || rows?.length !== 120) throw new Error('Unable to load complete personality responses for quality checks')
  const byId = new Map(rows.map(row => [String(row.item_id), row]))
  const core = IPIP_ITEMS.map(item => {
    const row = byId.get(IPIP_DATABASE.items[item.itemId as keyof typeof IPIP_DATABASE.items])
    if (!row || row.section_id !== IPIP_DATABASE.sectionId) throw new Error('Invalid native response identity')
    return { value: Number(row.response_value), timeMs: row.response_time_ms == null ? null : Number(row.response_time_ms) }
  })
  const result = analyseResponseQuality(core, supplement ? { version: supplement.version, answers: supplement.answers } : null)
  const { error: insertError } = await db.from('participant_response_quality_results').upsert({ session_id: sessionId, policy_version: QUALITY_POLICY_VERSION, status: result.status, result }, { onConflict: 'session_id,policy_version', ignoreDuplicates: true })
  if (insertError) throw new Error('Unable to store response-quality checks')
}

export async function getSessionResponseQuality(sessionId: string): Promise<ResponseQualityDetail | null> {
  const access = await requireSessionAccess(sessionId)
  assertIndividualResultsAccess(access.scope, access.confidentialityMode)
  const db = createAdminClient()
  const { data, error } = await db.from('participant_response_quality_results').select('id,result,computed_at').eq('session_id', sessionId).eq('policy_version', QUALITY_POLICY_VERSION).maybeSingle()
  if (error) throw new Error('Unable to load response-quality checks')
  if (!data) return null
  const { data: reviews, error: reviewError } = await db.from('response_quality_reviews').select('id,decision,notes,reviewer_id,created_at').eq('result_id', data.id).order('created_at', { ascending: false }).order('id', { ascending: false })
  if (reviewError) throw new Error('Unable to load response-quality review history')
  return { id: String(data.id), computedAt: String(data.computed_at), result: data.result as ResponseQualityResult,
    canReview: Boolean(access.scope.actor && canManageCampaign(access.scope, access.partnerId, access.clientId)),
    reviews: (reviews ?? []).map(r => ({ id: String(r.id), decision: r.decision as QualityReviewDecision, notes: String(r.notes), reviewerId: r.reviewer_id as string, createdAt: String(r.created_at) })) }
}

/** IDs must come from an already authorised participant/session listing. */
export async function getAuthorizedResponseQualitySummaries(db: SupabaseClient, sessionIds: string[]): Promise<Map<string, QualityStatus>> {
  if (!sessionIds.length) return new Map()
  const { data, error } = await db.from('participant_response_quality_results').select('session_id,status').in('session_id', sessionIds).eq('policy_version', QUALITY_POLICY_VERSION)
  if (error) throw new Error('Unable to load response-quality summaries')
  return new Map((data ?? []).map(row => [String(row.session_id), row.status as QualityStatus]))
}

export async function recordResponseQualityReview(input: { sessionId: string; resultId: string; reviewId: string; decision: QualityReviewDecision; notes: string }) {
  const access = await requireSessionAccess(input.sessionId)
  assertIndividualResultsAccess(access.scope, access.confidentialityMode)
  if (!access.scope.actor || !canManageCampaign(access.scope, access.partnerId, access.clientId)) throw new Error('You do not have permission to review this assessment')
  const db = createAdminClient()
  const { data: result, error: resultError } = await db.from('participant_response_quality_results').select('id').eq('id', input.resultId).eq('session_id', input.sessionId).eq('policy_version', QUALITY_POLICY_VERSION).single()
  if (resultError || !result) throw new Error('Response-quality result not found')
  const row = { id: input.reviewId, result_id: input.resultId, reviewer_id: access.scope.actor.id, decision: input.decision, notes: input.notes.trim() }
  const { error } = await db.from('response_quality_reviews').upsert(row, { onConflict: 'id', ignoreDuplicates: true })
  if (error) throw new Error('Unable to record response-quality review')
  const { data: saved, error: savedError } = await db.from('response_quality_reviews').select('id,result_id,reviewer_id,decision,notes').eq('id', input.reviewId).single()
  if (savedError || !saved || Object.entries(row).some(([key, value]) => saved[key as keyof typeof saved] !== value)) throw new Error('This review request has already been used')
}
