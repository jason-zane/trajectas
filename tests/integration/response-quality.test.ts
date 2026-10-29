import { describe, expect, it } from 'vitest'
import { canRun, createAdminClient } from './_helpers/rls-fixture'
import { getOrCreateSectionForms } from '@/lib/dal/session-forms'
import { readResponseQualityModule, persistSessionResponseQuality } from '@/lib/dal/response-quality'
import { scoreIpipNeo120Session } from '@/lib/dal/ipip-neo-120'
import { IPIP_DATABASE } from '@/lib/instrument/ipip-neo-120/database-form'
import { IPIP_ITEMS } from '@/lib/instrument/ipip-neo-120/definition'
import { QUALITY_QUESTIONS } from '@/lib/instrument/ipip-neo-120/response-quality'

describe.skipIf(!canRun)('response quality: disposable CI only', () => {
  it('freezes a separate supplement, handles retries/stale tabs, preserves native scoring and stores immutable review evidence', async () => {
    const db = createAdminClient()
    const { data: session, error } = await db.from('participant_sessions').insert({ assessment_id: IPIP_DATABASE.assessmentId, status: 'in_progress', is_internal: true }).select('id').single()
    expect(error).toBeNull()
    const sessionId = String(session!.id)
    const forms = await getOrCreateSectionForms(db, { sessionId, assessmentId: IPIP_DATABASE.assessmentId, campaignId: null })
    expect('error' in forms).toBe(false)
    const supplement = await readResponseQualityModule(db, sessionId)
    expect(supplement?.questions).toEqual(QUALITY_QUESTIONS)
    expect(supplement?.answers).toEqual({})
    const save = (key: string, value: number, revision: number) => db.rpc('save_response_quality_answer', { p_session_id: sessionId, p_question_id: key, p_value: value, p_expected_revision: revision })
    const first = await save('attention_agree', 4, 0)
    expect(first.error).toBeNull()
    expect((await save('attention_agree', 4, 0)).data).toEqual(first.data)
    expect((await save('attention_agree', 3, 0)).error?.code).toBe('PT409')
    expect((await save('unknown', 3, 1)).error?.code).toBe('23514')
    expect((await save('attention_agree', 6, 1)).error?.code).toBe('23514')
    for (const [i, q] of QUALITY_QUESTIONS.entries()) {
      if (i === 0) continue
      expect((await save(q.id, q.id === 'attention_disagree' ? 1 : 2, i)).error).toBeNull()
    }
    expect((await db.from('participant_responses').insert(IPIP_ITEMS.map((item, i) => ({ session_id: sessionId, section_id: IPIP_DATABASE.sectionId, item_id: IPIP_DATABASE.items[item.itemId as keyof typeof IPIP_DATABASE.items], response_value: i % 5 + 1, response_time_ms: 3000 })))).error).toBeNull()
    expect((await db.from('participant_sessions').update({ status: 'completed' }).eq('id', sessionId)).error).toBeNull()
    expect((await save('attention_agree', 3, 8)).error).not.toBeNull()
    expect(await scoreIpipNeo120Session(db, sessionId)).toEqual({ success: true, scoreCount: 30 })
    await persistSessionResponseQuality(db, sessionId)
    await persistSessionResponseQuality(db, sessionId)
    const { data: results, error: resultError } = await db.from('participant_response_quality_results').select('id,status,result').eq('session_id', sessionId)
    expect(resultError).toBeNull(); expect(results).toHaveLength(1)
    expect(results![0].status).toBe('no_concerns_detected')
    const native = await db.from('participant_instrument_results').select('result').eq('session_id', sessionId).single()
    expect(native.data?.result.responseCount).toBe(120)
    expect(native.data?.result.overallScore).toBeNull()
    expect((await db.from('participant_responses').select('id').eq('session_id', sessionId)).data).toHaveLength(120)
    const reviewId = crypto.randomUUID()
    const review = { id: reviewId, result_id: results![0].id, reviewer_id: crypto.randomUUID(), decision: 'accepted', notes: 'Synthetic fixture reviewed in context.' }
    expect((await db.from('response_quality_reviews').upsert(review, { onConflict: 'id', ignoreDuplicates: true })).error).toBeNull()
    expect((await db.from('response_quality_reviews').upsert(review, { onConflict: 'id', ignoreDuplicates: true })).error).toBeNull()
    expect((await db.from('response_quality_reviews').select('id').eq('result_id', results![0].id)).data).toHaveLength(1)
    expect((await db.from('response_quality_reviews').update({ notes: 'Rewritten' }).eq('id', reviewId)).error).not.toBeNull()
    expect((await db.from('participant_response_quality_results').delete().eq('session_id', sessionId)).error).not.toBeNull()
    // The authorised parent-session purge still cascades all supplemental rows.
    expect((await db.from('participant_sessions').delete().eq('id', sessionId)).error).toBeNull()
    expect((await db.from('session_response_quality_modules').select('session_id').eq('session_id', sessionId)).data).toEqual([])
    expect((await db.from('response_quality_reviews').select('id').eq('id', reviewId)).data).toEqual([])
  }, 60_000)
  it('does not add a supplement when reconstructing a completed legacy form', async () => {
    const db = createAdminClient()
    const { data } = await db.from('participant_sessions').insert({ assessment_id: IPIP_DATABASE.assessmentId, status: 'completed', is_internal: true }).select('id').single()
    const sessionId = String(data!.id)
    await getOrCreateSectionForms(db, { sessionId, assessmentId: IPIP_DATABASE.assessmentId, campaignId: null })
    expect(await readResponseQualityModule(db, sessionId)).toBeNull()
    await db.from('participant_sessions').delete().eq('id', sessionId)
  })
})
