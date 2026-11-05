import 'server-only'
import {z} from 'zod'
import type { createAdminClient } from '@/lib/supabase/admin'
import { privacyLedgerEntrySchema, type PrivacyLedger } from './ledger'
import { drainPrivacyDeletionJobs } from './deletion-worker'
import { safeObjectPath } from './types'

const replayInventorySchema=z.object({
  participants:z.number().int().nonnegative(),sessions:z.number().int().nonnegative(),
  snapshots:z.number().int().nonnegative(),objects:z.number().int().nonnegative(),
  raters:z.number().int().nonnegative(),unverifiedRaterScope:z.literal(0),
}).catchall(z.number().int().nonnegative())

/** Run only against a quarantined restore. No notifications, billing or scoring. */
export async function replayPrivacyLedger(options: {
  client:ReturnType<typeof createAdminClient>;ledger:PrivacyLedger;targetUrl:string;
  execute?:boolean;quarantined?:boolean;approvedHostedTarget?:string;
}) {
  const target=new URL(options.targetUrl)
  const local=['127.0.0.1','localhost','[::1]'].includes(target.hostname)
  if(options.execute&&(!options.quarantined||(!local&&options.approvedHostedTarget!==target.origin)))throw new Error('recovery_requires_quarantined_approved_target')
  const entries=(await options.ledger.read()).map(entry=>privacyLedgerEntrySchema.parse(entry))
    .filter(entry=>!entry.expiresAt||Date.parse(entry.expiresAt)>Date.now())
  const db=options.client
  let replayed=0,blocked=0,accounts=0
  const holds=entries.filter(entry=>entry.kind==='hold')
  // Holds must be restored before any deletion. A partial restore never reopens.
  if(options.execute)for(const entry of holds) {
    const result=await db.rpc('privacy_replay_hold',{p_entry:entry})
    if(result.error)throw new Error('recovery_hold_replay_failed')
  }
  for(const entry of entries) {
    if(entry.kind==='account') {
      if(!options.execute){accounts++;continue}
      const result=await db.auth.admin.deleteUser(entry.profileId)
      if(result.error) {
        const check=await db.auth.admin.getUserById(entry.profileId)
        if(!check.error||(check.error.status!==404&&check.error.code!=='user_not_found'))throw new Error('recovery_auth_deletion_failed')
      }
      const profile=await db.from('profiles').select('id').eq('id',entry.profileId).maybeSingle()
      if(profile.error||profile.data)throw new Error('recovery_auth_verification_failed')
      accounts++;continue
    }
    if(entry.kind!=='deletion')continue
    // Legacy entries cannot prove all rater identities and governing holds.
    // Require a reviewed ledger upgrade before claiming verified recovery.
    if(!entry.raterIds||!entry.holdParticipantIds){blocked++;continue}
    const before=await db.rpc('privacy_replay_remaining',{p_entry:entry})
    const inventory=replayInventorySchema.safeParse(before.data)
    if(before.error||!inventory.success)throw new Error('recovery_inventory_failed')
    if(!options.execute){if(Object.values(inventory.data).some(count=>count>0))blocked++;continue}
    const currentHolds=await db.from('privacy_legal_holds').select('participant_id').eq('campaign_id',entry.campaignId).is('released_at',null)
    if(currentHolds.error)throw new Error('recovery_hold_check_failed')
    const holdScope=new Set([...entry.participantIds,...entry.holdParticipantIds])
    if(currentHolds.data?.some(hold=>!hold.participant_id||holdScope.has(hold.participant_id))){blocked++;continue}
    const queued=await db.rpc('privacy_replay_deletion',{p_entry:entry})
    if(queued.error)throw new Error('recovery_deletion_queue_failed')
    if(queued.data) {
      const result=await drainPrivacyDeletionJobs({client:db,ledger:options.ledger,mode:'execute',requestId:entry.id})
      if(result.processed!==1){blocked++;continue}
    } else {
      // DB cascade may already be absent while objects came from a separate backup.
      if(entry.objects.some(object=>!safeObjectPath(object.path)))throw new Error('recovery_unsafe_object_path')
      for(const bucket of ['reports','outcome-sources'] as const) {
        const paths=entry.objects.filter(object=>object.bucket===bucket).map(object=>object.path)
        for(let offset=0;offset<paths.length;offset+=50) {
          const result=await db.storage.from(bucket).remove(paths.slice(offset,offset+50))
          if(result.error)throw new Error('recovery_object_deletion_failed')
        }
      }
    }
    const after=await db.rpc('privacy_replay_remaining',{p_entry:entry})
    const remaining=replayInventorySchema.safeParse(after.data)
    if(after.error||!remaining.success||Object.values(remaining.data).some(count=>count!==0))throw new Error('recovery_absence_verification_failed')
    replayed++
  }
  return {mode:options.execute?'execute':'plan',ledgerEntries:entries.length,holds:holds.length,accountEntries:accounts,replayed,blocked,privacyReplayVerified:Boolean(options.execute&&blocked===0)}
}
