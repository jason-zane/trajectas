import 'server-only'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { deletionManifestSchema, objectReferenceSchema, safeObjectPath, dataLifecycleMode } from './types'
import { createPrivacyLedger, type PrivacyLedger } from './ledger'
import {reportError} from '@/lib/observability/report-error'

type Db = ReturnType<typeof createAdminClient>
const objectList = z.array(objectReferenceSchema)
class PrivacyWorkerFailure extends Error {
  readonly code: string
  constructor(code: string) { super(code);this.code=code }
}

/** System-only worker. The cron authenticates; admin actions have separate scope checks. */
export async function drainPrivacyDeletionJobs(options: {
  client?: Db
  mode?: 'plan' | 'execute'
  timeBudgetMs?: number
  ledger?: PrivacyLedger
  requestId?:string
} = {}) {
  const mode = options.mode ?? dataLifecycleMode()
  if (mode !== 'execute') return { mode, processed: 0, reviewRequired: 0, failed: 0, deferred: 0 }
  const ledger = options.ledger ?? createPrivacyLedger()
  const db = options.client ?? createAdminClient()
  const { data, error } = options.requestId ? await db.rpc('privacy_claim_deletion',{p_request:options.requestId}) : await db.rpc('privacy_claim_deletion')
  if (error) throw new PrivacyWorkerFailure('claim_failed')
  const request = data?.[0] as { id: string; participant_id:string; lease_id: string; policy_id: string; campaign_id: string; approved_at: string } | undefined
  if (!request) return { mode, processed: 0, reviewRequired: 0, failed: 0, deferred: 0 }
  const args = { p_request: request.id, p_lease: request.lease_id }
  const started = Date.now()
  try {
    const prepared = await db.rpc('privacy_prepare_deletion', args)
    if (prepared.error) throw new PrivacyWorkerFailure('prepare_failed')
    const manifest = deletionManifestSchema.parse(prepared.data)
    if (manifest.blockers.length) {
      await reportError(new Error('Privacy review required'),{source:'privacy.worker.review_required',severity:'warning',alert:true,context:{requestId:request.id,count:manifest.blockers.length}})
      return { mode, processed: 0, reviewRequired: 1, failed: 0, deferred: 0 }
    }
    const policy = await db.from('privacy_retention_policies').select('version,backup_days').eq('id', request.policy_id).eq('status', 'active').single()
    if (policy.error || !policy.data) throw new PrivacyWorkerFailure('policy_unavailable')
    const external = await ledger.read().catch(() => { throw new PrivacyWorkerFailure('external_ledger_unavailable') })
    const holdScope=new Set([...manifest.participantIds,...manifest.holdParticipantIds])
    if (external.some(entry => entry.kind === 'hold' && entry.status === 'active' && entry.campaignId === request.campaign_id
      && (!entry.participantId || holdScope.has(entry.participantId)))) throw new PrivacyWorkerFailure('external_legal_hold')
    const expiresAt = new Date(Date.now() + (policy.data.backup_days + 1) * 86400_000).toISOString()
    const digest = await ledger.put({ kind: 'deletion', id: request.id, participantId:request.participant_id, participantIds: manifest.participantIds,
      raterIds: manifest.raterIds, holdParticipantIds:manifest.holdParticipantIds, sessionIds: manifest.sessionIds, snapshotIds: manifest.snapshotIds, objects: manifest.objects,
      campaignId: request.campaign_id, approvedAt: request.approved_at, policyVersion: policy.data.version,
      backupDays: policy.data.backup_days, expiresAt }).catch(() => { throw new PrivacyWorkerFailure('external_ledger_write_failed') })
    const acknowledged = await db.rpc('privacy_confirm_external_ledger', { ...args, p_digest: digest, p_expires: expiresAt })
    if (acknowledged.error) throw new PrivacyWorkerFailure('external_ledger_unconfirmed')
    for (let batch = 0; batch < 8; batch++) {
      const pending = await db.rpc('privacy_pending_storage_objects', args)
      if (pending.error) throw new PrivacyWorkerFailure('storage_manifest_failed')
      const objects = objectList.parse(pending.data)
      if (!objects.length) {
        const completed = await db.rpc('privacy_finish_active_deletion', args)
        if (completed.error) throw new PrivacyWorkerFailure('verification_failed')
        return { mode, processed: 1, reviewRequired: 0, failed: 0, deferred: 0 }
      }
      if (Date.now() - started >= (options.timeBudgetMs ?? 40_000)) break
      const selected = objects.slice(0, 50)
      if (selected.some(object => !safeObjectPath(object.path))) throw new PrivacyWorkerFailure('unsafe_object_path')
      // A hold or a superseded lease must stop every new external operation.
      const lease = await db.rpc('privacy_check_deletion_lease', args)
      if (lease.error || lease.data !== true) throw new PrivacyWorkerFailure('lease_or_hold_changed')
      for (const bucket of ['reports', 'outcome-sources'] as const) {
        const paths = selected.filter(object => object.bucket === bucket).map(object => object.path)
        if (!paths.length) continue
        const result = await db.storage.from(bucket).remove(paths)
        if (result.error) throw new PrivacyWorkerFailure('storage_delete_failed')
      }
    }
    const released = await db.rpc('privacy_release_deletion', { ...args, p_error_code: null })
    if (released.error) throw new PrivacyWorkerFailure('lease_release_failed')
    return { mode, processed: 0, reviewRequired: 0, failed: 0, deferred: 1 }
  } catch (error) {
    const code = error instanceof PrivacyWorkerFailure ? error.code : 'invalid_worker_data'
    // Store a fixed code, never object paths, email addresses or SDK payloads.
    const released = await db.rpc('privacy_release_deletion', { ...args, p_error_code: code })
    if (released.error) throw new PrivacyWorkerFailure('failure_record_failed')
    await reportError(new Error('Privacy disposal requires review'),{source:'privacy.worker.'+code,severity:'error',alert:true,context:{requestId:request.id}})
    return { mode, processed: 0, reviewRequired: 0, failed: 1, deferred: 0 }
  }
}

/** Bound a sweep by elapsed time and job count so expiry does not grow forever. */
export async function drainPrivacyDeletionQueue(options: NonNullable<Parameters<typeof drainPrivacyDeletionJobs>[0]> & {maxJobs?:number}={}) {
  const mode=options.mode??dataLifecycleMode()
  const total={mode,processed:0,reviewRequired:0,failed:0,deferred:0}
  if(mode!=='execute')return total
  const started=Date.now(),budget=options.timeBudgetMs??30000
  for(let index=0;index<Math.min(options.maxJobs??20,100)&&Date.now()-started<budget;index++) {
    const result=await drainPrivacyDeletionJobs({...options,timeBudgetMs:Math.max(0,budget-(Date.now()-started))})
    total.processed+=result.processed;total.reviewRequired+=result.reviewRequired;total.failed+=result.failed;total.deferred+=result.deferred
    if(result.failed||result.deferred||result.processed+result.reviewRequired===0)break
  }
  return total
}
