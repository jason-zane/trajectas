import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { drainPrivacyDeletionQueue } from '@/lib/privacy/deletion-worker'
import { dataLifecycleMode } from '@/lib/privacy/types'
import {createPrivacyLedger} from '@/lib/privacy/ledger'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return new Response('Not configured', { status: 503 })
  const expected = Buffer.from(`Bearer ${secret}`), actual = Buffer.from(request.headers.get('authorization') ?? '')
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return new Response('Unauthorized', { status: 401 })
  if (dataLifecycleMode() !== 'execute') return NextResponse.json({ mode: 'plan', processed: 0 })
  const db = createAdminClient()
  try {
    const ledger=createPrivacyLedger(),entries=await ledger.read()
    // An external hold can outlive a failed source write or an older DB restore.
    // Reconcile it before any source-side expiry, including diagnostics.
    for(const entry of entries)if(entry.kind==='hold'&&entry.status==='active') {
      const held=await db.rpc('privacy_replay_hold',{p_entry:entry})
      if(held.error)throw new Error('hold_reconciliation_failed')
    }
    const operations = await db.from('privacy_retention_policies').select('id').eq('scope', 'operations').eq('status', 'active').maybeSingle()
    if (operations.error||!operations.data) throw new Error('operations_policy_required')
    const research = await db.rpc('privacy_expire_research_cases')
    if (research.error) throw new Error('research_expiry_failed')
    if (operations.data) {
      const expired = await db.rpc('privacy_expire_diagnostics', { p_policy: operations.data.id })
      if (expired.error) throw new Error('diagnostic_expiry_failed')
      const receipts = await db.rpc('privacy_expire_lifecycle_receipts', { p_policy: operations.data.id })
      if(receipts.error)throw new Error('receipt_expiry_failed')
    }
    const enqueued = await db.rpc('privacy_enqueue_expired_participants')
    if (enqueued.error) throw new Error('enqueue_failed')
    const result = await drainPrivacyDeletionQueue({ client: db,ledger:{put:entry=>ledger.put(entry),read:async()=>entries},timeBudgetMs:30000 })
    const completed = await db.rpc('privacy_complete_expired_deletions')
    if (completed.error) throw new Error('completion_failed')
    return NextResponse.json({ ...result, enqueued: enqueued.data, completed: completed.data },{status:result.failed?503:200})
  } catch {
    // No SDK messages or deletion manifest content in cron responses/logs.
    console.error('[privacy-retention] sweep failed')
    return NextResponse.json({ error: 'Privacy sweep failed' }, { status: 500 })
  }
}
