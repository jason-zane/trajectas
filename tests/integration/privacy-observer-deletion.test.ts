import {randomBytes,randomUUID} from 'node:crypto'
import {beforeAll,describe,expect,it} from 'vitest'
import {canRun,createAdminClient} from './_helpers/rls-fixture'
import {drainPrivacyDeletionJobs} from '@/lib/privacy/deletion-worker'
import {replayPrivacyLedger} from '@/lib/privacy/recovery'
import type {DeletionLedgerEntry,PrivacyLedger,PrivacyLedgerEntry} from '@/lib/privacy/ledger'

describe.skipIf(!canRun)('privacy deletion of 360 observers',()=>{
  const db=createAdminClient(),client=randomUUID(),assessment=randomUUID(),policy=randomUUID()
  const entries=new Map<string,PrivacyLedgerEntry>()
  const ledger:PrivacyLedger={read:async()=>[...entries.values()],put:async entry=>{entries.set(entry.id,entry);return 'd'.repeat(64)}}
  async function insert(table:string,row:unknown){expect((await db.from(table).insert(row)).error,table).toBeNull()}
  beforeAll(async()=>{
    await insert('clients',{id:client,name:'Synthetic observer privacy',slug:client})
    await insert('assessments',{id:assessment,title:'Synthetic observer privacy',slug:assessment,status:'active'})
    await insert('privacy_retention_policies',{id:policy,name:'Synthetic observer retention',version:policy,status:'active',approved_at:new Date().toISOString(),retention_months:12,backup_days:7})
  })
  async function person(campaign:string,raterId?:string){
    const id=randomUUID(),session=randomUUID(),token=randomBytes(32).toString('hex')
    await insert('campaign_participants',{id,campaign_id:campaign,email:`${id}@example.invalid`,access_token:token,campaign_rater_id:raterId??null})
    await insert('participant_sessions',{id:session,campaign_id:campaign,campaign_participant_id:id,client_id:client,assessment_id:assessment,status:'completed'})
    return {id,session,token}
  }
  async function fixture(){
    const campaign=randomUUID()
    await insert('campaigns',{id:campaign,client_id:client,title:'Synthetic 360 privacy',slug:campaign,kind:'leadership_360',status:'active'})
    const subject=await person(campaign)
    async function observer(){
      const rater=randomUUID(),raterToken=randomBytes(32).toString('hex'),email=`${rater}@example.invalid`
      await insert('campaign_raters',{id:rater,campaign_id:campaign,subject_participant_id:subject.id,relationship:'peer',name:'Synthetic observer',email,access_token:raterToken,status:'completed'})
      const participant=await person(campaign,rater)
      expect((await db.from('campaign_raters').update({session_id:participant.session}).eq('id',rater)).error).toBeNull()
      return {...participant,rater,raterToken,email}
    }
    const target=await observer(),peer=await observer()
    return {campaign,subject,target,peer}
  }
  async function request(campaign:string,participant:string){
    const id=randomUUID()
    await insert('privacy_deletion_requests',{id,participant_id:participant,campaign_id:campaign,client_id:client,policy_id:policy,reason:'individual_request',status:'approved',approved_at:new Date().toISOString()})
    return id
  }
  async function erase(f:Awaited<ReturnType<typeof fixture>>){
    const id=await request(f.campaign,f.target.id)
    expect((await drainPrivacyDeletionJobs({client:db,ledger,mode:'execute',requestId:id})).processed).toBe(1)
    return entries.get(id) as DeletionLedgerEntry
  }
  async function restoreRater(f:Awaited<ReturnType<typeof fixture>>){
    await insert('campaign_raters',{id:f.target.rater,campaign_id:f.campaign,subject_participant_id:f.subject.id,relationship:'peer',name:'Restored synthetic observer',email:f.target.email,access_token:f.target.raterToken,status:'completed'})
  }
  it('deletes the observer rater identity and both tokens while preserving the subject and peer',async()=>{
    const f=await fixture(),id=await request(f.campaign,f.target.id)
    const raterAudit=randomUUID(),peerAudit=randomUUID()
    await insert('audit_events',[{id:raterAudit,event_type:'synthetic.rater',client_id:client,target_id:f.target.rater,metadata:{email:f.target.email}},{id:peerAudit,event_type:'synthetic.rater',client_id:client,target_id:f.peer.rater,metadata:{email:f.peer.email}}])
    const claim=await db.rpc('privacy_claim_deletion',{p_request:id})
    expect(claim.error).toBeNull()
    const args={p_request:id,p_lease:claim.data[0].lease_id}
    const prepared=await db.rpc('privacy_prepare_deletion',args)
    expect(prepared.error).toBeNull()
    expect((await db.rpc('privacy_confirm_external_ledger',{...args,p_digest:'d'.repeat(64),p_expires:new Date(Date.now()+8*86400000).toISOString()})).error).toBeNull()
    expect((await db.rpc('privacy_finish_active_deletion',args)).error).toBeNull()
    expect((await db.from('campaign_raters').select('id').eq('access_token',f.target.raterToken)).data).toEqual([])
    expect((await db.from('campaign_participants').select('id').eq('access_token',f.target.token)).data).toEqual([])
    expect((await db.from('audit_events').select('id').eq('id',raterAudit)).data).toEqual([])
    expect((await db.from('audit_events').select('id').eq('id',peerAudit)).data).toHaveLength(1)
    expect(prepared.data).toMatchObject({raterIds:[f.target.rater],participantIds:[f.target.id],sessionIds:[f.target.session]})
    expect((await db.from('campaign_raters').select('id').eq('id',f.peer.rater)).data).toHaveLength(1)
    expect((await db.from('participant_sessions').select('id').in('id',[f.subject.session,f.peer.session])).data).toHaveLength(2)
    expect((await db.from('privacy_deletion_requests').select('status').eq('id',id).single()).data?.status).toBe('backup_pending')
  })
  it('keeps subject deletion scoped to that subject and its own observers',async()=>{
    const f=await fixture(),other=await fixture(),id=await request(f.campaign,f.subject.id)
    expect((await drainPrivacyDeletionJobs({client:db,ledger,mode:'execute',requestId:id})).processed).toBe(1)
    const entry=entries.get(id) as DeletionLedgerEntry
    expect(entry.raterIds).toEqual(expect.arrayContaining([f.target.rater,f.peer.rater]))
    expect((await db.from('campaign_raters').select('id').eq('campaign_id',f.campaign)).data).toEqual([])
    expect((await db.from('campaign_participants').select('id').eq('campaign_id',f.campaign)).data).toEqual([])
    expect((await db.from('campaign_raters').select('id').eq('campaign_id',other.campaign)).data).toHaveLength(2)
  })
  it('records rater scope externally and erases an orphan rater restored without its participant',async()=>{
    const f=await fixture(),entry=await erase(f)
    expect(entry.raterIds).toEqual([f.target.rater])
    await restoreRater(f)
    const source:PrivacyLedger={read:async()=>[entry],put:ledger.put}
    const plan=await replayPrivacyLedger({client:db,ledger:source,targetUrl:process.env.NEXT_PUBLIC_SUPABASE_URL!})
    expect(plan.blocked).toBe(1)
    const replay=await replayPrivacyLedger({client:db,ledger:source,targetUrl:process.env.NEXT_PUBLIC_SUPABASE_URL!,execute:true,quarantined:true})
    expect(replay.privacyReplayVerified).toBe(true)
    expect((await db.from('campaign_raters').select('id').eq('id',f.target.rater)).data).toEqual([])
    expect((await db.from('campaign_participants').select('id').eq('id',f.subject.id)).data).toHaveLength(1)
  })
  it('preserves rater records when the related subject is on hold',async()=>{
    const f=await fixture(),hold=randomUUID(),id=await request(f.campaign,f.target.id)
    await insert('privacy_legal_holds',{id:hold,campaign_id:f.campaign,participant_id:f.subject.id,reason:'Synthetic related-subject hold',review_at:new Date().toISOString()})
    try {
      const result=await drainPrivacyDeletionJobs({client:db,ledger,mode:'execute',requestId:id})
      expect(result.failed).toBe(1)
      expect(entries.has(id)).toBe(false)
      expect((await db.from('campaign_raters').select('id').eq('id',f.target.rater)).data).toHaveLength(1)
      expect((await db.from('campaign_participants').select('deleted_at').eq('id',f.target.id).single()).data?.deleted_at).toBeNull()
    } finally {expect((await db.from('privacy_legal_holds').update({released_at:new Date().toISOString()}).eq('id',hold)).error).toBeNull()}
  })
  it('does not claim verified recovery for a legacy entry with unknown rater scope',async()=>{
    const f=await fixture(),entry=await erase(f),legacy={...entry}
    delete legacy.raterIds
    await restoreRater(f)
    const source:PrivacyLedger={read:async()=>[legacy],put:ledger.put}
    const replay=await replayPrivacyLedger({client:db,ledger:source,targetUrl:process.env.NEXT_PUBLIC_SUPABASE_URL!,execute:true,quarantined:true})
    expect(replay.blocked).toBe(1);expect(replay.privacyReplayVerified).toBe(false)
    expect((await db.rpc('privacy_replay_remaining',{p_entry:legacy})).data?.unverifiedRaterScope).toBe(1)
    expect((await db.from('campaign_raters').select('id').eq('id',f.target.rater)).data).toHaveLength(1)
  })
  it('blocks orphan recovery when a rater ID has moved into another campaign',async()=>{
    const f=await fixture(),entry=await erase(f),other=await fixture()
    await insert('campaign_raters',{id:f.target.rater,campaign_id:other.campaign,subject_participant_id:other.subject.id,relationship:'peer',name:'Different synthetic owner',email:f.target.email,access_token:f.target.raterToken})
    const source:PrivacyLedger={read:async()=>[entry],put:ledger.put}
    await expect(replayPrivacyLedger({client:db,ledger:source,targetUrl:process.env.NEXT_PUBLIC_SUPABASE_URL!,execute:true,quarantined:true})).rejects.toThrow('recovery_deletion_queue_failed')
    expect((await db.from('campaign_raters').select('id').eq('id',f.target.rater)).data).toHaveLength(1)
  })
  it('rejects a rater session pointer that would erase a peer session',async()=>{
    const f=await fixture(),id=await request(f.campaign,f.target.id)
    expect((await db.from('campaign_raters').update({session_id:f.peer.session}).eq('id',f.target.rater)).error).toBeNull()
    expect((await drainPrivacyDeletionJobs({client:db,ledger,mode:'execute',requestId:id})).failed).toBe(1)
    expect((await db.from('participant_sessions').select('id').in('id',[f.target.session,f.peer.session])).data).toHaveLength(2)
    expect((await db.from('campaign_raters').select('id').in('id',[f.target.rater,f.peer.rater])).data).toHaveLength(2)
  })
  it('requires a newly discovered rater to be prepared and externally recorded before erasure',async()=>{
    const f=await fixture(),id=await request(f.campaign,f.subject.id)
    const claim=await db.rpc('privacy_claim_deletion',{p_request:id})
    expect(claim.error).toBeNull()
    const args={p_request:id,p_lease:claim.data[0].lease_id}
    expect((await db.rpc('privacy_prepare_deletion',args)).error).toBeNull()
    expect((await db.rpc('privacy_confirm_external_ledger',{...args,p_digest:'d'.repeat(64),p_expires:new Date(Date.now()+8*86400000).toISOString()})).error).toBeNull()
    const later=randomUUID()
    await insert('campaign_raters',{id:later,campaign_id:f.campaign,subject_participant_id:f.subject.id,relationship:'peer',email:`${later}@example.invalid`})
    expect((await db.rpc('privacy_finish_active_deletion',args)).error?.code).toBe('55000')
    expect((await db.from('campaign_raters').select('id').eq('campaign_id',f.campaign)).data).toHaveLength(3)
    expect((await db.from('campaign_participants').select('id').eq('id',f.subject.id)).data).toHaveLength(1)
  })
})
