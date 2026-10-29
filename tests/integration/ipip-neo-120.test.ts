import { describe, expect, it } from 'vitest'
import { canRun, createAdminClient } from './_helpers/rls-fixture'
import { getOrCreateSectionForms } from '@/lib/dal/session-forms'
import { scoreIpipNeo120Session } from '@/lib/dal/ipip-neo-120'
import { getAuthorizedIpipNeo120Result } from '@/lib/dal/ipip-neo-120'
import { IPIP_DATABASE, assertIpipDatabaseForms } from '@/lib/instrument/ipip-neo-120/database-form'
import { IPIP_ITEMS } from '@/lib/instrument/ipip-neo-120/definition'
import { scoreIpipNeo120 } from '@/lib/scoring/ipip-neo-120'
import fixtures from '@/lib/instrument/ipip-neo-120/source/scoring-fixtures.json'

// CI/disposable stack only. Immutable result rows intentionally survive until
// stack disposal; cleanup must never weaken the result immutability trigger.
describe.skipIf(!canRun)('IPIP-NEO-120 native integration', () => {
  it('activates the branded complete form while preserving immutable scientific content', async () => {
    const db = createAdminClient()
    const { data: assessment, error } = await db.from('assessments').select('title,status,scoring_profile').eq('id',IPIP_DATABASE.assessmentId).single()
    expect(error).toBeNull()
    expect(assessment).toMatchObject({title:'Trajectas Personality Profile',status:'active',scoring_profile:'ipip_neo_120_v1'})
    const { data: binding } = await db.from('standardized_assessment_forms').select('activation_ready,definition').eq('assessment_id',IPIP_DATABASE.assessmentId).single()
    expect(binding?.activation_ready).toBe(true)
    const delivery = await db.rpc('get_ipip_neo_120_delivery', { p_assessment_id: IPIP_DATABASE.assessmentId })
    expect(delivery.error).toBeNull()
    expect(delivery.data.cataloguePresentationVersion).toBe('trajectas-personality-profile-catalogue-v1')
    for (const table of ['dimensions', 'constructs', 'factors']) {
      expect(delivery.data.rows[table].every((row: { description: string }) => !/^[NEOAC][1-6]? — /.test(row.description))).toBe(true)
    }
    const edit = await db.from('items').update({stem:'Changed'}).eq('id',IPIP_DATABASE.items.q001)
    expect(edit.error?.code).toBe('23514')
    const rewriteStatus = await db.from('assessments').update({status:'draft'}).eq('id',IPIP_DATABASE.assessmentId)
    expect(rewriteStatus.error?.code).toBe('23514')
    const editBinding = await db.from('standardized_assessment_forms').update({definition:{}}).eq('assessment_id',IPIP_DATABASE.assessmentId)
    expect(editBinding.error).not.toBeNull()
    const shorten = await db.from('assessment_section_items').delete().eq('section_id',IPIP_DATABASE.sectionId).eq('item_id',IPIP_DATABASE.items.q001)
    expect(shorten.error?.code).toBe('23514')
  })
  it('rejects new facets under a native dimension and partial campaign selections, including moving a facet out', async () => {
    const db=createAdminClient()
    const stamp=Date.now().toString()
    const ins=async(table:string,row:Record<string,unknown>)=>{
      const {data,error}=await db.from(table).insert(row).select('id').single()
      if(error) throw new Error(`${table}: ${error.message}`)
      return String(data!.id)
    }
    const extra=await db.from('factors').insert({name:'Not a native facet',slug:`ipip-extra-${stamp}`,dimension_id:IPIP_DATABASE.dimensions.N})
    expect(extra.error?.code).toBe('23514')
    const partner=await ins('partners',{name:'IPIP contract fixture',slug:`ipip-partner-${stamp}`})
    const client=await ins('clients',{name:'IPIP contract fixture',slug:`ipip-client-${stamp}`,partner_id:partner})
    const campaign=await ins('campaigns',{title:'IPIP contract fixture',slug:`ipip-campaign-${stamp}`,client_id:client,partner_id:partner,status:'draft',is_internal:true})
    const ca=await ins('campaign_assessments',{campaign_id:campaign,assessment_id:IPIP_DATABASE.assessmentId})
    const factorIds=Object.values(IPIP_DATABASE.facets).map(f=>f.factorId)
    const partial=await db.from('campaign_assessment_factors').insert({campaign_assessment_id:ca,factor_id:factorIds[0]})
    expect(partial.error?.code).toBe('23514')
    const full=await db.from('campaign_assessment_factors').insert(factorIds.map(factor_id=>({campaign_assessment_id:ca,factor_id})))
    expect(full.error).toBeNull()
    const delivery=await db.rpc('get_ipip_neo_120_delivery',{p_assessment_id:IPIP_DATABASE.assessmentId,p_campaign_id:campaign})
    expect(delivery.error).toBeNull()
    const omit=await db.from('campaign_assessment_factors').delete().eq('campaign_assessment_id',ca).eq('factor_id',factorIds[0])
    expect(omit.error?.code).toBe('23514')
    const other=await ins('assessments',{title:'Other fixture',slug:`ipip-other-${stamp}`})
    const otherCa=await ins('campaign_assessments',{campaign_id:campaign,assessment_id:other})
    const move=await db.from('campaign_assessment_factors').update({campaign_assessment_id:otherCa}).eq('campaign_assessment_id',ca).eq('factor_id',factorIds[0])
    expect(move.error?.code).toBe('23514')
    const remaining=await db.from('campaign_assessment_factors').select('factor_id').eq('campaign_assessment_id',ca)
    expect(remaining.data).toHaveLength(30)
    // Only these task-owned fixtures are removed; the imported instrument remains immutable.
    await db.from('campaign_assessment_factors').delete().eq('campaign_assessment_id',ca)
    await db.from('campaign_assessments').delete().eq('campaign_id',campaign)
    await db.from('campaigns').delete().eq('id',campaign)
    await db.from('assessments').delete().eq('id',other)
    await db.from('clients').delete().eq('id',client)
    await db.from('partners').delete().eq('id',partner)
  },60_000)
  it.each(fixtures)('freezes, resumes, scores and retries fixture $id without changing native direction', async fixture => {
    const db = createAdminClient()
    const { data: session,error } = await db.from('participant_sessions').insert({assessment_id:IPIP_DATABASE.assessmentId,status:'completed',is_internal:true}).select('id').single()
    expect(error).toBeNull()
    const sessionId = String(session!.id)
    const input = {sessionId,assessmentId:IPIP_DATABASE.assessmentId,campaignId:null}
    const forms = await getOrCreateSectionForms(db,input)
    expect('error' in forms).toBe(false)
    if ('error' in forms) throw new Error(forms.error)
    assertIpipDatabaseForms(forms)
    expect(await getOrCreateSectionForms(db,input)).toEqual(forms)
    const values = fixture.responses as Record<string,number>
    const answers = await db.from('participant_responses').insert(IPIP_ITEMS.map(item => ({session_id:sessionId,section_id:IPIP_DATABASE.sectionId,
      item_id:IPIP_DATABASE.items[item.itemId as keyof typeof IPIP_DATABASE.items],response_value:values[item.itemId]})))
    expect(answers.error).toBeNull()
    const expected = scoreIpipNeo120(IPIP_ITEMS.map(item=>({itemId:item.itemId,value:values[item.itemId]})))
    expect(await scoreIpipNeo120Session(db,sessionId)).toEqual({success:true,scoreCount:30})
    expect(await scoreIpipNeo120Session(db,sessionId)).toEqual({success:true,scoreCount:30})
    expect(await getAuthorizedIpipNeo120Result(db,sessionId,IPIP_DATABASE.assessmentId)).toEqual(expected)
    const scores = await db.from('participant_scores').select('factor_id,raw_score,scaled_score,percentile,metric').eq('session_id',sessionId)
    expect(scores.error).toBeNull();expect(scores.data).toHaveLength(30)
    const n4=scores.data!.find(row=>row.factor_id===IPIP_DATABASE.facets.N4.factorId)!
    expect(Number(n4.raw_score)).toBe(expected.facets.N4.native.rawSum)
    expect(Number(n4.scaled_score)).toBeCloseTo(expected.facets.N4.display.pomp)
    expect(scores.data!.every(row=>row.percentile===null && row.metric==='personality_pomp')).toBe(true)
    const overall=await db.from('participant_sessions').select('composite_score,composite_method').eq('id',sessionId).single()
    expect(overall.data).toEqual({composite_score:null,composite_method:null})
    const mutation=await db.from('participant_instrument_results').update({result:{}}).eq('session_id',sessionId)
    expect(mutation.error).not.toBeNull()
  },60_000)
  it('does not persist scores for incomplete responses', async () => {
    const db=createAdminClient()
    const {data,error}=await db.from('participant_sessions').insert({assessment_id:IPIP_DATABASE.assessmentId,status:'completed',is_internal:true}).select('id').single()
    expect(error).toBeNull()
    const sessionId=String(data!.id)
    expect(await scoreIpipNeo120Session(db,sessionId)).toHaveProperty('error')
    const stored=await db.from('participant_instrument_results').select('session_id').eq('session_id',sessionId)
    expect(stored.data).toEqual([])
    // No result exists, but the frozen form is immutable: disposable stack owns cleanup.
  })
})
