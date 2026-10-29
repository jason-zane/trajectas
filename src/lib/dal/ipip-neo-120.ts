import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { IPIP_DATABASE, assertIpipDatabaseForms } from '@/lib/instrument/ipip-neo-120/database-form'
import { IPIP_ITEMS, IPIP_ITEMSET_SHA256 } from '@/lib/instrument/ipip-neo-120/definition'
import { getOrCreateSectionForms } from './session-forms'
import { scoreIpipNeo120, type IpipNeo120Result } from '@/lib/scoring/ipip-neo-120'

/** Internal scoring boundary: called only by the authorized completion dispatcher. */
export async function scoreIpipNeo120Session(db: SupabaseClient, sessionId: string) {
  const { data: session, error } = await db.from('participant_sessions')
    .select('assessment_id, campaign_id, status').eq('id', sessionId).single()
  if (error || !session) return { error: error?.message ?? 'Session not found' }
  if (session.assessment_id !== IPIP_DATABASE.assessmentId || session.status !== 'completed') {
    return { error: 'Invalid IPIP-NEO-120 assessment or completion state' }
  }
  try {
    const forms = await getOrCreateSectionForms(db, { sessionId, assessmentId: session.assessment_id, campaignId: session.campaign_id })
    if ('error' in forms) return forms
    assertIpipDatabaseForms(forms)
    const { data: rows, error: responseError } = await db.from('participant_responses')
      .select('item_id, section_id, response_value').eq('session_id', sessionId)
    if (responseError) return { error: responseError.message }
    const stableIds = new Map(IPIP_ITEMS.map(item => [IPIP_DATABASE.items[item.itemId as keyof typeof IPIP_DATABASE.items], item.itemId]))
    const responses = (rows ?? []).map(row => {
      if (row.section_id !== IPIP_DATABASE.sectionId || !stableIds.has(row.item_id)) throw new Error('Unexpected IPIP response item or section')
      return { itemId: stableIds.get(row.item_id)!, value: row.response_value }
    })
    const result = scoreIpipNeo120(responses)
    const { error: persistenceError } = await db.rpc('persist_ipip_neo_120_result', { p_session_id: sessionId, p_result: result })
    if (persistenceError) return { error: persistenceError.message }
    return { success: true as const, scoreCount: 30 }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to score IPIP-NEO-120' }
  }
}

/** Caller MUST have authorized individual-result access to this exact session.
 * Report generation already authorizes the snapshot/session; session detail calls
 * this only after tenant and aggregate-only privacy checks. No public action.
 */
export async function getAuthorizedIpipNeo120Result(db: SupabaseClient, sessionId: string, assessmentId: string): Promise<IpipNeo120Result | null> {
  if (assessmentId !== IPIP_DATABASE.assessmentId) return null
  const { data, error } = await db.from('participant_instrument_results').select('result')
    .eq('session_id', sessionId).eq('assessment_id', assessmentId).maybeSingle()
  if (error) throw new Error('Unable to load personality assessment results')
  if (!data) return null
  const result = data.result as IpipNeo120Result
  if (result.itemsetSha256 !== IPIP_ITEMSET_SHA256 || result.overallScore !== null || result.normReference !== null) throw new Error('Invalid personality assessment result')
  return result
}
