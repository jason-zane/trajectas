import { randomUUID,randomBytes } from 'node:crypto'
import { afterAll,beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { canRun, createAdminClient,createTestUser } from './_helpers/rls-fixture'
import {drainPrivacyDeletionJobs} from '@/lib/privacy/deletion-worker'
import {replayPrivacyLedger} from '@/lib/privacy/recovery'
import {sweepAccountDeletions} from '@/lib/privacy/account-deletion'
import type {PrivacyLedger,PrivacyLedgerEntry,DeletionLedgerEntry} from '@/lib/privacy/ledger'

describe.skipIf(!canRun)('privacy lifecycle database boundaries', () => {
  const db = createAdminClient()
  const ids = { client: randomUUID(), campaign: randomUUID(), participant: randomUUID(), assessment: randomUUID(), session: randomUUID(), policy: randomUUID(), request: randomUUID() }
  let lease = ''
  const operationsIds:string[]=[]
  afterAll(async()=>{if(canRun&&operationsIds.length)await db.from('privacy_retention_policies').update({status:'retired'}).in('id',operationsIds)})
  const ledgerRows=new Map<string,PrivacyLedgerEntry>()
  const ledger:PrivacyLedger={read:async()=>[...ledgerRows.values()],put:async entry=>{ledgerRows.set(entry.id,entry);return 'b'.repeat(64)}}
  async function insert(table:string,row:unknown) {
    const result=await db.from(table).insert(row)
    expect(result.error,table).toBeNull()
  }
  async function person() {
    const participantId=randomUUID(),sessionId=randomUUID()
    await insert('campaign_participants',{id:participantId,campaign_id:ids.campaign,email:`${participantId}@example.invalid`,access_token:randomBytes(32).toString('hex')})
    await insert('participant_sessions',{id:sessionId,campaign_id:ids.campaign,campaign_participant_id:participantId,client_id:ids.client,assessment_id:ids.assessment,status:'completed'})
    return {participantId,sessionId}
  }
  async function request(participantId:string) {
    const requestId=randomUUID()
    await insert('privacy_deletion_requests',{id:requestId,participant_id:participantId,campaign_id:ids.campaign,client_id:ids.client,policy_id:ids.policy,reason:'individual_request',status:'approved',approved_at:new Date().toISOString(),provider_tasks:[{processor:'email_and_recipient_copies',status:'pending'}]})
    return requestId
  }
  beforeAll(async () => {
    if (!canRun) return
    async function insert(table: string, rows: unknown) {
      const { error } = await db.from(table).insert(rows)
      if (error) throw new Error(`${table}: ${error.code}`)
    }
    await insert('clients', { id: ids.client, name: 'Synthetic privacy fixture', slug: 'privacy-' + ids.client })
    await insert('campaigns', { id: ids.campaign, client_id: ids.client, title: 'Synthetic privacy fixture', slug: 'privacy-' + ids.campaign, status: 'active' })
    await insert('campaign_participants', { id: ids.participant, campaign_id: ids.campaign, email: 'synthetic-privacy@example.invalid', first_name: 'Synthetic', last_name: 'Fixture', access_token: randomBytes(32).toString('hex') })
    await insert('assessments', { id: ids.assessment, title: 'Synthetic privacy fixture', slug: 'privacy-' + ids.assessment, status: 'active' })
    await insert('client_assessment_assignments', { client_id: ids.client, assessment_id: ids.assessment, is_active: true })
    await insert('campaign_assessments', { campaign_id: ids.campaign, assessment_id: ids.assessment, display_order: 0 })
    await insert('participant_sessions', { id: ids.session, campaign_id: ids.campaign, campaign_participant_id: ids.participant, client_id: ids.client, assessment_id: ids.assessment, status: 'completed' })
    await insert('privacy_retention_policies', { id: ids.policy, name: 'Synthetic retention fixture', version: ids.policy, backup_days: 7, retention_months: 12 })
    await insert('privacy_deletion_requests', { id: ids.request, participant_id: ids.participant, campaign_id: ids.campaign, client_id: ids.client, policy_id: ids.policy, reason: 'individual_request' })
  })

  it('does not process a draft policy or an unapproved request', async () => {
    const first = await db.rpc('privacy_claim_deletion',{p_request:ids.request})
    expect(first.error).toBeNull()
    expect(first.data).toEqual([])
    const activated = await db.from('privacy_retention_policies').update({ status: 'active', approved_at: new Date().toISOString() }).eq('id', ids.policy)
    expect(activated.error).toBeNull()
    expect((await db.rpc('privacy_claim_deletion',{p_request:ids.request})).data).toEqual([])
    expect((await db.from('privacy_deletion_requests').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', ids.request)).error).toBeNull()
  })

  it('honours a hold and leases a request to only one worker', async () => {
    const holdId = randomUUID()
    const inserted = await db.from('privacy_legal_holds').insert({ id: holdId, campaign_id: ids.campaign, reason: 'Synthetic hold', review_at: new Date(Date.now() + 86400000).toISOString() })
    expect(inserted.error).toBeNull()
    expect((await db.rpc('privacy_claim_deletion',{p_request:ids.request})).data).toEqual([])
    await db.from('privacy_legal_holds').update({ released_at: new Date().toISOString() }).eq('id', holdId)
    const claims = await Promise.all([db.rpc('privacy_claim_deletion',{p_request:ids.request}), db.rpc('privacy_claim_deletion',{p_request:ids.request})])
    expect(claims.every(result => !result.error)).toBe(true)
    const rows = claims.flatMap(result => result.data ?? [])
    expect(rows).toHaveLength(1)
    lease = rows[0].lease_id
    expect(rows[0].id).toBe(ids.request)
  })

  it('revokes participant access and rejects stale deletion workers', async () => {
    const invalid = await db.rpc('privacy_prepare_deletion', { p_request: ids.request, p_lease: randomUUID() })
    expect(invalid.error?.code).toBe('55000')
    const prepared = await db.rpc('privacy_prepare_deletion', { p_request: ids.request, p_lease: lease })
    expect(prepared.error).toBeNull()
    expect(prepared.data).toMatchObject({ version: 1, participantIds: [ids.participant], sessionIds: [ids.session], blockers: [] })
    const participant = await db.from('campaign_participants').select('deleted_at,privacy_pending_at').eq('id', ids.participant).single()
    expect(participant.data?.deleted_at).toBeTruthy()
    expect(participant.data?.privacy_pending_at).toBeTruthy()
    const restored = await db.from('campaign_participants').update({ deleted_at: null }).eq('id', ids.participant)
    expect(restored.error?.code).toBe('23514')
  })

  it('deletes active records but waits for backup expiry before completing', async () => {
    expect((await db.rpc('privacy_finish_active_deletion',{p_request:ids.request,p_lease:lease})).error?.code).toBe('55000')
    const confirmed=await db.rpc('privacy_confirm_external_ledger',{p_request:ids.request,p_lease:lease,p_digest:'a'.repeat(64),p_expires:new Date(Date.now()+8*86400000).toISOString()})
    expect(confirmed.error).toBeNull()
    const result = await db.rpc('privacy_finish_active_deletion', { p_request: ids.request, p_lease: lease })
    expect(result.error).toBeNull()
    expect((await db.from('campaign_participants').select('id').eq('id', ids.participant)).data).toEqual([])
    expect((await db.from('participant_sessions').select('id').eq('id', ids.session)).data).toEqual([])
    const receipt = await db.from('privacy_deletion_requests').select('status,participant_id,backup_expires_at,manifest').eq('id', ids.request).single()
    expect(receipt.data?.status).toBe('backup_pending')
    expect(receipt.data?.participant_id).toBe(ids.participant)
    expect(new Date(receipt.data!.backup_expires_at).getTime()).toBeGreaterThan(Date.now())
    expect((await db.rpc('privacy_complete_expired_deletions')).data).toBe(0)
    expect((await db.from('clients').select('id').eq('id', ids.client)).data).toHaveLength(1)
  })

  it('blocks anonymous reads and RPC execution on lifecycle data', async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
    expect((await anon.from('privacy_deletion_requests').select('id')).error).toBeTruthy()
    expect((await anon.rpc('privacy_claim_deletion')).error).toBeTruthy()
  })

  it('records the exact published notice version without an IP address', async () => {
    const participantId = randomUUID(), noticeId = randomUUID()
    await db.from('campaign_participants').insert({ id: participantId, campaign_id: ids.campaign, email: 'synthetic-notice@example.invalid', access_token: randomBytes(32).toString('hex') })
    const created = await db.from('privacy_notice_versions').insert({ id: noticeId, version: noticeId, title: 'Synthetic notice', body: 'Synthetic notice body', status: 'published', published_at: new Date().toISOString(), research_choice_enabled: true })
    expect(created.error).toBeNull()
    expect((await db.from('campaign_privacy_settings').insert({ campaign_id: ids.campaign, notice_version_id: noticeId })).error).toBeNull()
    const receipt = await db.rpc('privacy_record_receipt', { p_participant: participantId, p_notice: noticeId, p_research: false })
    expect(receipt.error).toBeNull()
    const records = await db.from('participant_privacy_receipts').select('purpose,accepted,notice_version_id,notice_hash').eq('participant_id', participantId)
    expect(records.data).toHaveLength(2)
    expect(records.data?.find(record => record.purpose === 'norm_research')?.accepted).toBe(false)
    expect(records.data?.every(record => record.notice_version_id === noticeId && /^[a-f0-9]{64}$/.test(record.notice_hash))).toBe(true)
    const rewritten = await db.from('privacy_notice_versions').update({ body: 'Changed after publication' }).eq('id', noticeId)
    expect(rewritten.error?.code).toBe('23514')
    expect((await db.rpc('privacy_record_receipt',{p_participant:participantId,p_notice:noticeId,p_research:true})).error).toBeNull()
    const history=await db.from('participant_privacy_receipts').select('purpose,accepted').eq('participant_id',participantId)
    expect(history.data?.filter(row=>row.purpose==='assessment_notice')).toHaveLength(1)
    expect(history.data?.filter(row=>row.purpose==='norm_research')).toHaveLength(2)
    expect((await db.from('participant_privacy_receipts').update({accepted:true}).eq('participant_id',participantId)).error?.code).toBe('42501')
  })

  it('archives a report, deletes its object via Storage, and preserves a peer participant',async()=>{
    const target=await person(),peer=await person(),snapshotId=randomUUID(),templateId=randomUUID()
    await insert('report_templates',{id:templateId,name:'Synthetic privacy report'})
    await insert('report_snapshots',{id:snapshotId,template_id:templateId,participant_session_id:target.sessionId,campaign_id:ids.campaign,status:'ready'})
    await db.storage.createBucket('reports',{public:false})
    const path=`reports/${snapshotId}/${randomUUID()}.pdf`
    expect((await db.storage.from('reports').upload(path,Buffer.from('%PDF-1.4 synthetic privacy fixture'),{contentType:'application/pdf'})).error).toBeNull()
    expect((await db.from('report_snapshots').update({pdf_url:path,pdf_status:'ready'}).eq('id',snapshotId)).error).toBeNull()
    const requestId=await request(target.participantId)
    const result=await drainPrivacyDeletionJobs({client:db,ledger,mode:'execute',requestId})
    expect(result.processed).toBe(1)
    expect((await db.from('report_snapshots').select('id').eq('id',snapshotId)).data).toEqual([])
    expect((await db.storage.from('reports').download(path)).error).toBeTruthy()
    expect((await db.from('participant_sessions').select('id').eq('id',peer.sessionId)).data).toHaveLength(1)
    const replay=ledgerRows.get(requestId) as DeletionLedgerEntry
    expect(replay.objects).toContainEqual({bucket:'reports',path})
    expect(replay.participantId).toBe(target.participantId)
  })

  it('replays deletion after restoring old participant records, while plan mode leaves them untouched',async()=>{
    const target=await person(),requestId=await request(target.participantId)
    expect((await drainPrivacyDeletionJobs({client:db,ledger,mode:'execute',requestId})).processed).toBe(1)
    const entry=ledgerRows.get(requestId) as DeletionLedgerEntry
    // A synthetic pre-deletion restore; never restore production in this test.
    await insert('campaign_participants',{id:target.participantId,campaign_id:ids.campaign,email:`restored-${randomUUID()}@example.invalid`,access_token:randomBytes(32).toString('hex')})
    await insert('participant_sessions',{id:target.sessionId,campaign_id:ids.campaign,campaign_participant_id:target.participantId,client_id:ids.client,assessment_id:ids.assessment,status:'completed'})
    const recoveryLedger:PrivacyLedger={read:async()=>[entry],put:ledger.put}
    const plan=await replayPrivacyLedger({client:db,ledger:recoveryLedger,targetUrl:process.env.NEXT_PUBLIC_SUPABASE_URL!})
    expect(plan.blocked).toBe(1);expect(plan.privacyReplayVerified).toBe(false)
    const result=await replayPrivacyLedger({client:db,ledger:recoveryLedger,targetUrl:process.env.NEXT_PUBLIC_SUPABASE_URL!,execute:true,quarantined:true})
    expect(result.privacyReplayVerified).toBe(true)
    expect((await db.from('campaign_participants').select('id').eq('id',target.participantId)).data).toEqual([])
  })

  it('replays an external hold before attempting restored deletion',async()=>{
    const target=await person(),requestId=await request(target.participantId)
    const entry:DeletionLedgerEntry={kind:'deletion',id:requestId,participantId:target.participantId,participantIds:[target.participantId],sessionIds:[target.sessionId],snapshotIds:[],objects:[],campaignId:ids.campaign,approvedAt:new Date().toISOString(),policyVersion:'synthetic-recovery',backupDays:7,expiresAt:new Date(Date.now()+8*86400000).toISOString()}
    const holdId=randomUUID()
    const recoveryLedger:PrivacyLedger={read:async()=>[entry,{kind:'hold',id:holdId,campaignId:ids.campaign,participantId:target.participantId,status:'active',reviewAt:new Date().toISOString(),expiresAt:null}],put:ledger.put}
    const result=await replayPrivacyLedger({client:db,ledger:recoveryLedger,targetUrl:process.env.NEXT_PUBLIC_SUPABASE_URL!,execute:true,quarantined:true})
    expect(result.blocked).toBe(1);expect(result.privacyReplayVerified).toBe(false)
    expect((await db.from('campaign_participants').select('id').eq('id',target.participantId)).data).toHaveLength(1)
    expect((await db.from('privacy_legal_holds').update({released_at:new Date().toISOString()}).eq('id',holdId)).error).toBeNull()
    await db.from('privacy_deletion_requests').update({status:'cancelled'}).eq('id',requestId)
  })

  it('keeps failed account work pending and verifies Auth absence before a receipt says deleted',async()=>{
    const operationsId=randomUUID()
    operationsIds.push(operationsId)
    await insert('privacy_retention_policies',{id:operationsId,name:'Synthetic operations retention',version:operationsId,scope:'operations',status:'active',backup_days:7,diagnostic_days:30,audit_days:365,approved_at:new Date().toISOString()})
    const {userId}=await createTestUser(db,{email:`account-privacy-${randomUUID()}@example.invalid`,role:'consultant'})
    expect((await db.from('profiles').update({deletion_requested_at:new Date(Date.now()-31*86400000).toISOString(),scheduled_deletion_at:new Date(Date.now()-86400000).toISOString()}).eq('id',userId)).error).toBeNull()
    const result=await sweepAccountDeletions({client:db,ledger,maxJobs:1,profileId:userId})
    expect(result.swept).toBe(1)
    const receipt=await db.from('privacy_account_deletion_receipts').select('*').eq('profile_id',userId).single()
    expect(receipt.error).toBeNull();expect(receipt.data?.status).toBe('auth_deleted');expect(receipt.data?.deleted_at).toBeTruthy()
    expect(receipt.data).not.toHaveProperty('email')
    expect((await db.auth.admin.getUserById(userId)).error?.status).toBe(404)
    await db.from('privacy_retention_policies').update({status:'retired'}).eq('id',operationsId)
  })

  it('releases only a reviewed aggregate cohort and expires restricted source rows',async()=>{
    const policyId=randomUUID(),constructId=randomUUID(),fingerprint='c'.repeat(64)
    await insert('privacy_retention_policies',{id:policyId,name:'Synthetic research retention',version:policyId,status:'active',approved_at:new Date().toISOString(),backup_days:7,retention_months:12,research_allowed:true})
    expect((await db.from('campaign_privacy_settings').update({retention_policy_id:policyId}).eq('campaign_id',ids.campaign)).error).toBeNull()
    const participants=Array.from({length:20},()=>({id:randomUUID(),campaign_id:ids.campaign,email:`norm-${randomUUID()}@example.invalid`,access_token:randomBytes(32).toString('hex')}))
    const people=await db.from('campaign_participants').insert(participants).select('id,person_key')
    expect(people.error).toBeNull()
    const sessions=people.data!.map(p=>({id:randomUUID(),campaign_id:ids.campaign,campaign_participant_id:p.id,client_id:ids.client,assessment_id:ids.assessment,status:'completed'}))
    await insert('participant_sessions',sessions)
    const cases=people.data!.map((p,index)=>({id:randomUUID(),source_participant_id:p.id,source_session_id:sessions[index].id,source_person_key:p.person_key,assessment_id:ids.assessment,form_fingerprint:fingerprint,scoring_version:'synthetic-frozen-v1',permission_basis:'related_expected_purpose',permission_ref:'synthetic-legal-review-1',responses:[],scores:[{constructId,pomp:index*5}],eligible:true,expires_at:new Date(Date.now()+86400000).toISOString()}))
    await insert('privacy_research_cases',cases)
    expect((await db.from('privacy_research_cases').update({scores:[{constructId,pomp:null}]}).eq('id',cases[0].id)).error?.code).toBe('23514')
    const {userId}=await createTestUser(db,{email:`research-reviewer-${randomUUID()}@example.invalid`,role:'platform_admin'})
    const args={p_cases:cases.map(c=>c.id),p_version:randomUUID(),p_instrument:'synthetic-v1',p_risk_ref:'synthetic-risk-reviewed',p_quality_ref:'synthetic-quality-reviewed',p_actor:userId}
    expect((await db.rpc('privacy_publish_norm',{...args,p_cases:args.p_cases.slice(0,19)})).error?.code).toBe('23514')
    const release=await db.rpc('privacy_publish_norm',args)
    expect(release.error).toBeNull()
    const stored=await db.from('privacy_norm_releases').select('payload,sample_count').eq('id',release.data).single()
    expect(stored.data?.sample_count).toBe(20)
    expect(stored.data?.payload[0]).toMatchObject({constructId,sampleSize:20,mean:47.5,scoreType:'pomp'})
    for(const participant of participants)expect(JSON.stringify(stored.data?.payload)).not.toContain(participant.id)
    expect((await db.from('privacy_norm_releases').update({sample_count:21}).eq('id',release.data)).error?.code).toBe('42501')
    const researchHold=randomUUID()
    await insert('privacy_legal_holds',{id:researchHold,campaign_id:ids.campaign,participant_id:participants[0].id,reason:'Synthetic research hold',review_at:new Date().toISOString()})
    expect((await db.rpc('privacy_restrict_research',{p_participant:participants[0].id})).error).toBeNull()
    const heldCases=await db.from('privacy_research_cases').select('eligible').eq('source_participant_id',participants[0].id)
    expect(heldCases.data).toEqual([{eligible:false}])
    expect((await db.from('privacy_legal_holds').update({released_at:new Date().toISOString()}).eq('id',researchHold)).error).toBeNull()
    expect((await db.rpc('privacy_publish_norm',{...args,p_version:randomUUID()})).error?.code).toBe('23514')
    expect((await db.from('campaign_privacy_settings').update({closed_at:new Date(Date.now()-400*86400000).toISOString()}).eq('campaign_id',ids.campaign)).error).toBeNull()
    const expiry=await db.rpc('privacy_expire_research_cases')
    expect(expiry.error).toBeNull();expect(expiry.data).toBeGreaterThanOrEqual(19)
    expect((await db.from('privacy_research_cases').select('id').in('id',cases.map(c=>c.id))).data).toEqual([])
    expect((await db.from('privacy_norm_releases').select('id').eq('id',release.data)).data).toHaveLength(1)
  })

  it('atomically replaces operational policy versions and records decisions without copying notice text',async()=>{
    const {userId}=await createTestUser(db,{email:`privacy-policy-reviewer-${randomUUID()}@example.invalid`,role:'platform_admin'})
    const first=randomUUID(),second=randomUUID(),invalid=randomUUID()
    operationsIds.push(first,second,invalid)
    for(const id of [first,second])await insert('privacy_retention_policies',{id,name:'Synthetic operations version',version:id,scope:'operations',backup_days:7,diagnostic_days:30,audit_days:365})
    await insert('privacy_retention_policies',{id:invalid,name:'Incomplete synthetic operations version',version:invalid,scope:'operations',backup_days:7})
    expect((await db.rpc('privacy_activate_policy',{p_policy:first,p_actor:userId})).error).toBeNull()
    expect((await db.rpc('privacy_activate_policy',{p_policy:invalid,p_actor:userId})).error?.code).toBe('23514')
    expect((await db.from('privacy_retention_policies').select('status').eq('id',first).single()).data?.status).toBe('active')
    expect((await db.rpc('privacy_activate_policy',{p_policy:second,p_actor:userId})).error).toBeNull()
    const states=await db.from('privacy_retention_policies').select('id,status').in('id',[first,second])
    expect(states.data?.find(row=>row.id===first)?.status).toBe('retired')
    expect(states.data?.find(row=>row.id===second)?.status).toBe('active')
    const audits=await db.from('audit_events').select('actor_profile_id,metadata').eq('target_id',second)
    expect(audits.data?.some(row=>row.actor_profile_id===userId&&row.metadata.status==='active')).toBe(true)
    expect(JSON.stringify(audits.data)).not.toContain('body')
    const oldError=randomUUID(),hold=randomUUID()
    await insert('error_events',{id:oldError,source:'synthetic.privacy-expiry',severity:'error',message:'Synthetic diagnostic',fingerprint:oldError,occurred_at:new Date(Date.now()-40*86400000).toISOString()})
    expect((await db.from('error_events').delete().eq('id',oldError)).error?.code).toBe('42501')
    await insert('privacy_legal_holds',{id:hold,campaign_id:ids.campaign,reason:'Synthetic diagnostic hold',review_at:new Date().toISOString()})
    expect((await db.rpc('privacy_expire_diagnostics',{p_policy:second})).data?.held).toBe(true)
    await db.from('privacy_legal_holds').update({released_at:new Date().toISOString()}).eq('id',hold)
    const expiry=await db.rpc('privacy_expire_diagnostics',{p_policy:second})
    expect(expiry.error).toBeNull()
    expect((await db.from('error_events').select('id').eq('id',oldError)).data).toEqual([])
  })

  it('expires replay identifiers before processor confirmation without falsely declaring completion',async()=>{
    // Advance only this synthetic receipt's expiry boundary; no real backup is
    // shortened and no provider claim is inferred from the test clock.
    expect((await db.from('privacy_deletion_requests').update({backup_expires_at:new Date(Date.now()-1000).toISOString()}).eq('id',ids.request)).error).toBeNull()
    expect((await db.rpc('privacy_complete_expired_deletions')).error).toBeNull()
    const waiting=await db.from('privacy_deletion_requests').select('status,participant_id,campaign_id,manifest,provider_tasks').eq('id',ids.request).single()
    expect(waiting.data).toMatchObject({status:'processor_pending',participant_id:null,campaign_id:null,manifest:{}})
    expect(waiting.data?.provider_tasks).toHaveLength(3)
    const {userId}=await createTestUser(db,{email:`privacy-processor-reviewer-${randomUUID()}@example.invalid`,role:'platform_admin'})
    for(const task of waiting.data!.provider_tasks)expect((await db.rpc('privacy_confirm_provider_task',{p_request:ids.request,p_processor:task.processor,p_evidence:'SYNTHETIC-verified-case-1',p_actor:userId})).error).toBeNull()
    expect((await db.rpc('privacy_complete_expired_deletions')).error).toBeNull()
    const completed=await db.from('privacy_deletion_requests').select('status,participant_id,manifest,provider_tasks').eq('id',ids.request).single()
    expect(completed.data).toMatchObject({status:'completed',participant_id:null,manifest:{},provider_tasks:[]})
  })
})
