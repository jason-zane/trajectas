import {randomUUID} from 'node:crypto'
import {describe,expect,it,vi} from 'vitest'
import type {createAdminClient} from '@/lib/supabase/admin'
import {sweepAccountDeletions} from '@/lib/privacy/account-deletion'
import type {PrivacyLedger} from '@/lib/privacy/ledger'

function fixture() {
  const receipt={id:randomUUID(),profile_id:randomUUID(),requested_at:new Date().toISOString(),lease_id:randomUUID()}
  const order:string[]=[]
  const rpc=vi.fn(async(name:string)=>{order.push(name);return {data:name==='privacy_claim_account_deletion'?[receipt]:null,error:null}})
  const policy={select:()=>policy,eq:async()=>({data:[{scope:'operations',backup_days:7}],error:null})}
  const deleteUser=vi.fn(async()=>{order.push('auth.delete');return{error:null as null|{status:number;code:string}}})
  const getUserById=vi.fn(async()=>({data:{user:null},error:{status:404,code:'user_not_found'}}))
  const db={from:()=>policy,rpc,auth:{admin:{deleteUser,getUserById}}} as unknown as ReturnType<typeof createAdminClient>
  const ledger:PrivacyLedger={read:vi.fn(async()=>[]),put:vi.fn(async()=>{order.push('ledger.write');return'a'.repeat(64)})}
  return {db,rpc,deleteUser,getUserById,ledger,order,receipt}
}
describe('account disposal verification',()=>{
  it('records external replay before Auth deletion and success only after verification',async()=>{
    const f=fixture();expect(await sweepAccountDeletions({client:f.db,ledger:f.ledger,maxJobs:1})).toEqual({swept:1,errors:0})
    expect(f.order).toEqual(['privacy_claim_account_deletion','ledger.write','auth.delete','privacy_finish_account_deletion'])
    expect(f.rpc).toHaveBeenLastCalledWith('privacy_finish_account_deletion',expect.objectContaining({p_error:null}))
    expect(JSON.stringify(vi.mocked(f.ledger.put).mock.calls)).not.toContain('email')
  })
  it('does not call Auth if the durable external receipt is unavailable',async()=>{
    const f=fixture();vi.mocked(f.ledger.put).mockRejectedValueOnce(new Error('unavailable'))
    expect((await sweepAccountDeletions({client:f.db,ledger:f.ledger,maxJobs:1})).errors).toBe(1)
    expect(f.deleteUser).not.toHaveBeenCalled()
    expect(f.rpc).toHaveBeenLastCalledWith('privacy_finish_account_deletion',expect.objectContaining({p_error:'auth_delete_or_receipt_failed'}))
  })
  it('reconciles an ambiguous deletion that is already absent',async()=>{
    const f=fixture();f.deleteUser.mockResolvedValueOnce({error:{status:503,code:'timeout'}})
    expect((await sweepAccountDeletions({client:f.db,ledger:f.ledger,maxJobs:1})).swept).toBe(1)
    expect(f.getUserById).toHaveBeenCalledWith(f.receipt.profile_id)
  })
  it('does not equate an Auth read failure with absence',async()=>{
    const f=fixture();f.deleteUser.mockResolvedValueOnce({error:{status:503,code:'timeout'}});f.getUserById.mockResolvedValueOnce({data:{user:null},error:{status:503,code:'timeout'}})
    expect((await sweepAccountDeletions({client:f.db,ledger:f.ledger,maxJobs:1})).swept).toBe(0)
    expect(f.rpc).toHaveBeenLastCalledWith('privacy_finish_account_deletion',expect.objectContaining({p_error:'auth_delete_or_receipt_failed'}))
  })
  it('does not claim completion when the database receipt write fails',async()=>{
    const f=fixture();f.rpc.mockImplementation(async(name:string,args?:unknown)=>{void args;return{data:name==='privacy_claim_account_deletion'?[f.receipt]:null,error:name==='privacy_finish_account_deletion'?{code:'55000'}:null} as never})
    await expect(sweepAccountDeletions({client:f.db,ledger:f.ledger,maxJobs:1})).rejects.toThrow('account_failure_record_failed')
  })
})
