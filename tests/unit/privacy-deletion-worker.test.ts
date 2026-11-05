import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { createAdminClient } from '@/lib/supabase/admin'
import { drainPrivacyDeletionJobs } from '@/lib/privacy/deletion-worker'
import type { PrivacyLedger } from '@/lib/privacy/ledger'
vi.mock('@/lib/observability/report-error',()=>({reportError:vi.fn(async()=>{})}))

function fixture() {
  const history: string[] = []
  const participantId = randomUUID(), requestId = randomUUID(), leaseId = randomUUID(), campaignId = randomUUID()
  let objectPresent = true
  const manifest = { version: 1, participantIds: [participantId], raterIds: [randomUUID()], holdParticipantIds:[participantId], sessionIds: [], snapshotIds: [], objects: [{ bucket: 'reports', path: 'reports/synthetic/claim.pdf' }], blockers: [] as Array<{ kind: string; id: string }>, counts: { participants: 1, sessions: 0, snapshots: 0 } }
  const rpc = vi.fn(async (name: string) => {
    history.push(name)
    if (name === 'privacy_claim_deletion') return { data: [{ id: requestId, participant_id:participantId,lease_id: leaseId, policy_id: randomUUID(), campaign_id: campaignId, approved_at: new Date().toISOString() }], error: null }
    if (name === 'privacy_prepare_deletion') return { data: manifest, error: null }
    if (name === 'privacy_pending_storage_objects') return { data: objectPresent ? manifest.objects : [], error: null }
    if (name === 'privacy_check_deletion_lease') return { data: true, error: null }
    return { data: null, error: null }
  })
  const remove = vi.fn(async () => { history.push('storage.remove'); objectPresent = false; return { data: [], error: null as null | object } })
  const policy = { select: () => policy, eq: () => policy, single: async () => ({ data: { version: 'synthetic-v1', backup_days: 7 }, error: null }) }
  const db = { rpc, from: () => policy, storage: { from: () => ({ remove }) } } as unknown as ReturnType<typeof createAdminClient>
  const ledger: PrivacyLedger = {
    read: vi.fn(async () => []),
    put: vi.fn(async () => { history.push('ledger.confirmed'); return 'a'.repeat(64) }),
  }
  return { db, rpc, remove, history, ledger, manifest, campaignId, participantId }
}

describe('participant deletion worker', () => {
  it('does nothing destructive in plan mode', async () => {
    const f = fixture()
    expect((await drainPrivacyDeletionJobs({ client: f.db, ledger: f.ledger, mode: 'plan' })).mode).toBe('plan')
    expect(f.rpc).not.toHaveBeenCalled()
    expect(f.ledger.put).not.toHaveBeenCalled()
  })
  it('confirms external replay before object deletion and verifies storage before database purge', async () => {
    const f = fixture()
    expect((await drainPrivacyDeletionJobs({ client: f.db, ledger: f.ledger, mode: 'execute' })).processed).toBe(1)
    expect(f.history.indexOf('ledger.confirmed')).toBeLessThan(f.history.indexOf('storage.remove'))
    expect(f.history.indexOf('privacy_confirm_external_ledger')).toBeLessThan(f.history.indexOf('storage.remove'))
    expect(f.history.lastIndexOf('privacy_pending_storage_objects')).toBeGreaterThan(f.history.indexOf('storage.remove'))
    expect(f.history.at(-1)).toBe('privacy_finish_active_deletion')
    expect(f.ledger.put).toHaveBeenCalledWith(expect.objectContaining({raterIds:f.manifest.raterIds}))
    expect(f.ledger.put).toHaveBeenCalledWith(expect.objectContaining({holdParticipantIds:f.manifest.holdParticipantIds}))
  })
  it('keeps shared copies in review without deleting objects', async () => {
    const f = fixture(); f.manifest.blockers.push({ kind: 'shared_outcome_import', id: randomUUID() })
    expect((await drainPrivacyDeletionJobs({ client: f.db, ledger: f.ledger, mode: 'execute' })).reviewRequired).toBe(1)
    expect(f.remove).not.toHaveBeenCalled()
    expect(f.ledger.put).not.toHaveBeenCalled()
  })
  it('leaves a retryable request and no object loss when the independent ledger is unavailable', async () => {
    const f = fixture(); vi.mocked(f.ledger.put).mockRejectedValueOnce(new Error('synthetic provider failure'))
    expect((await drainPrivacyDeletionJobs({ client: f.db, ledger: f.ledger, mode: 'execute' })).failed).toBe(1)
    expect(f.remove).not.toHaveBeenCalled()
    expect(f.rpc).toHaveBeenLastCalledWith('privacy_release_deletion', expect.objectContaining({ p_error_code: 'external_ledger_write_failed' }))
  })
  it('honours a hold preserved outside an older database backup', async () => {
    const f = fixture()
    vi.mocked(f.ledger.read).mockResolvedValueOnce([{ kind: 'hold', id: randomUUID(), campaignId: f.campaignId, participantId: f.participantId, status: 'active', reviewAt: new Date().toISOString(), expiresAt: null }])
    expect((await drainPrivacyDeletionJobs({ client: f.db, ledger: f.ledger, mode: 'execute' })).failed).toBe(1)
    expect(f.remove).not.toHaveBeenCalled()
    expect(f.rpc).toHaveBeenLastCalledWith('privacy_release_deletion', expect.objectContaining({ p_error_code: 'external_legal_hold' }))
  })
  it('honours an external-only hold on the related subject of an observer',async()=>{
    const f=fixture(),subject=randomUUID()
    f.manifest.holdParticipantIds.push(subject)
    vi.mocked(f.ledger.read).mockResolvedValueOnce([{kind:'hold',id:randomUUID(),campaignId:f.campaignId,participantId:subject,status:'active',reviewAt:new Date().toISOString(),expiresAt:null}])
    expect((await drainPrivacyDeletionJobs({client:f.db,ledger:f.ledger,mode:'execute'})).failed).toBe(1)
    expect(f.remove).not.toHaveBeenCalled()
    expect(f.ledger.put).not.toHaveBeenCalled()
    expect(f.rpc.mock.calls.some(call=>call[0]==='privacy_finish_active_deletion')).toBe(false)
    expect(f.rpc).toHaveBeenLastCalledWith('privacy_release_deletion',expect.objectContaining({p_error_code:'external_legal_hold'}))
  })
  it('does not report success after a partial Storage API failure', async () => {
    const f = fixture(); f.remove.mockResolvedValueOnce({ data: [], error: { status: 503 } })
    expect((await drainPrivacyDeletionJobs({ client: f.db, ledger: f.ledger, mode: 'execute' })).failed).toBe(1)
    expect(f.rpc.mock.calls.some(call => call[0] === 'privacy_finish_active_deletion')).toBe(false)
  })
})
