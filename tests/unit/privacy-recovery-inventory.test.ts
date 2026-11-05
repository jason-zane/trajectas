import {randomUUID} from 'node:crypto'
import {describe,expect,it,vi} from 'vitest'
import type {createAdminClient} from '@/lib/supabase/admin'
import {replayPrivacyLedger} from '@/lib/privacy/recovery'
import type {DeletionLedgerEntry,PrivacyLedger} from '@/lib/privacy/ledger'

describe('quarantined recovery inventory protocol',()=>{
  const participantId=randomUUID()
  const entry:DeletionLedgerEntry={kind:'deletion',id:randomUUID(),participantId,participantIds:[participantId],holdParticipantIds:[participantId],raterIds:[randomUUID()],sessionIds:[],snapshotIds:[],objects:[],campaignId:randomUUID(),approvedAt:new Date().toISOString(),policyVersion:'synthetic-v1',backupDays:7,expiresAt:new Date(Date.now()+86400000).toISOString()}
  const legacyInventory={participants:0,sessions:0,snapshots:0,objects:0}
  const currentInventory={...legacyInventory,raters:0,unverifiedRaterScope:0}
  function fixture(before:unknown,after:unknown=before){
    let reads=0
    const rpc=vi.fn(async(name:string)=>({error:null,data:name==='privacy_replay_remaining'?(reads++?after:before):false}))
    const holds={select:()=>holds,eq:()=>holds,is:async()=>({data:[],error:null})}
    const db={rpc,from:()=>holds} as unknown as ReturnType<typeof createAdminClient>
    const ledger:PrivacyLedger={read:async()=>[entry],put:vi.fn(async()=> 'e'.repeat(64))}
    return {rpc,run:()=>replayPrivacyLedger({client:db,ledger,targetUrl:'http://127.0.0.1:59321',execute:true,quarantined:true})}
  }
  it('refuses an old schema that reports no rater inventory before any purge',async()=>{
    const f=fixture(legacyInventory)
    await expect(f.run()).rejects.toThrow('recovery_inventory_failed')
    expect(f.rpc).toHaveBeenCalledTimes(1)
    expect(f.rpc).not.toHaveBeenCalledWith('privacy_replay_deletion',expect.anything())
  })
  it('does not declare absence verified if final inventory omits rater scope',async()=>{
    await expect(fixture(currentInventory,legacyInventory).run()).rejects.toThrow('recovery_absence_verification_failed')
  })
  it('leaves entries without governing hold scope blocked for review',async()=>{
    const legacy={...entry};delete legacy.holdParticipantIds
    const rpc=vi.fn()
    const db={rpc} as unknown as ReturnType<typeof createAdminClient>
    const ledger:PrivacyLedger={read:async()=>[legacy],put:vi.fn()}
    await expect(replayPrivacyLedger({client:db,ledger,targetUrl:'http://127.0.0.1:59321',execute:true,quarantined:true})).resolves.toMatchObject({blocked:1,privacyReplayVerified:false})
    expect(rpc).not.toHaveBeenCalled()
  })
  it('preserves unknown copy counts rather than ignoring future remaining data',async()=>{
    await expect(fixture(currentInventory,{...currentInventory,additionalCopies:1}).run()).rejects.toThrow('recovery_absence_verification_failed')
  })
  it('can verify a complete current inventory when every scoped object is absent',async()=>{
    await expect(fixture(currentInventory).run()).resolves.toMatchObject({replayed:1,blocked:0,privacyReplayVerified:true})
  })
})
