import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPrivacyLedger, type PrivacyLedger } from './ledger'

type Db = ReturnType<typeof createAdminClient>
/** Idempotent Auth deletion with a receipt that survives the profile cascade. */
export async function sweepAccountDeletions(options: { client?:Db; ledger?:PrivacyLedger; maxJobs?:number;profileId?:string }={}) {
  const db=options.client??createAdminClient()
  const ledger=options.ledger??createPrivacyLedger()
  const policies=await db.from('privacy_retention_policies').select('scope,backup_days').eq('status','active')
  if(policies.error) throw new Error('account_policy_unavailable')
  if(!policies.data?.some(p=>p.scope==='operations')) return {swept:0,errors:0,blocked:'operations_policy_required'}
  const backupDays=Math.max(...policies.data.map(p=>Number(p.backup_days)))
  if(!Number.isInteger(backupDays)||backupDays<1||backupDays>365) throw new Error('account_backup_window_invalid')
  let swept=0,errors=0
  for(let index=0;index<(options.maxJobs??10);index++) {
    const claim=options.profileId?await db.rpc('privacy_claim_account_deletion',{p_profile:options.profileId}):await db.rpc('privacy_claim_account_deletion')
    if(claim.error) throw new Error('account_claim_failed')
    const receipt=claim.data?.[0] as {id:string;profile_id:string;requested_at:string;lease_id:string}|undefined
    if(!receipt)break
    const args={p_receipt:receipt.id,p_lease:receipt.lease_id}
    const expiry=new Date(Date.now()+(backupDays+1)*86400000).toISOString()
    try {
      await ledger.read()
      await ledger.put({kind:'account',id:receipt.id,profileId:receipt.profile_id,requestedAt:receipt.requested_at,backupDays,expiresAt:expiry})
      const deletion=await db.auth.admin.deleteUser(receipt.profile_id)
      if(deletion.error) {
        const check=await db.auth.admin.getUserById(receipt.profile_id)
        if(!check.error || (check.error.status!==404 && check.error.code!=='user_not_found')) throw new Error('auth_delete_failed')
      }
      const completed=await db.rpc('privacy_finish_account_deletion',{...args,p_replay_until:expiry,p_error:null})
      if(completed.error)throw new Error('auth_delete_unverified')
      swept++
    } catch {
      const failed=await db.rpc('privacy_finish_account_deletion',{...args,p_replay_until:expiry,p_error:'auth_delete_or_receipt_failed'})
      if(failed.error)throw new Error('account_failure_record_failed')
      errors++
      break
    }
  }
  return {swept,errors}
}
