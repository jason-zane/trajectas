// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const isLocalSupabase = url === 'http://127.0.0.1:54321'
const canRun = process.env.CAPACITY_DB === '1' && isLocalSupabase && !!process.env.SUPABASE_SERVICE_ROLE_KEY
if (process.env.CAPACITY_DB === '1' && !isLocalSupabase) throw new Error('Local Supabase required')

describe.skipIf(!canRun)('durable report/PDF claims under concurrency (local only)', () => {
  const prefix = `pdf-capacity-${randomUUID().slice(0, 12)}`
  const ids: Record<string, string[]> = {}
  const db = canRun ? createClient(url!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) : null!
  async function insert(table: string, rows: Record<string, unknown> | Record<string, unknown>[]) {
    const result = await db.from(table).insert(rows).select('id')
    if (result.error) throw result.error
    ids[table] = [...(ids[table] ?? []), ...result.data.map(r => String(r.id))]
    return result.data.map(r => String(r.id))
  }
  beforeAll(async () => {
    const [client] = await insert('clients', { name: prefix, slug: prefix })
    const [campaign] = await insert('campaigns', { title: prefix, slug: prefix, client_id: client })
    const [assessment] = await insert('assessments', { title: prefix, slug: prefix })
    const [template] = await insert('report_templates', { name: prefix })
    const participants = await insert('campaign_participants', Array.from({ length: 12 }, (_, i) => ({
      campaign_id: campaign, email: `${prefix}-${i}@test.local`,
    })))
    const sessions = await insert('participant_sessions', participants.map(p => ({
      campaign_participant_id: p, campaign_id: campaign, assessment_id: assessment,
      client_id: client, status: 'completed', completed_at: new Date().toISOString(),
    })))
    await insert('report_snapshots', sessions.map(s => ({
      template_id: template, participant_session_id: s, campaign_id: campaign,
      status: 'released', pdf_status: 'queued', narrative_mode: 'derived',
    })))
  })
  beforeEach(async () => {
    const { error } = await db.from('report_snapshots').update({
      status: 'released', pdf_status: 'queued', pdf_url: null, pdf_attempt_count: 0,
      pdf_claim_token: null, pdf_started_at: null, pdf_next_attempt_at: null,
    }).in('id', ids.report_snapshots)
    if (error) throw error
  })
  afterAll(async () => {
    for (const table of ['report_snapshots', 'participant_sessions', 'campaign_participants',
      'campaigns', 'clients', 'report_templates', 'assessments']) {
      if (!ids[table]?.length) continue
      const { error } = await db.from(table).delete().in('id', ids[table])
      if (error) throw error
    }
  })

  it('one snapshot has one claim even when twelve requests race', async () => {
    const responses = await Promise.all(Array.from({ length: 12 }, () => db.rpc('claim_report_pdf_generation', {
      p_snapshot_id: ids.report_snapshots[0],
    })))
    expect(responses.every(r => !r.error)).toBe(true)
    expect(responses.filter(r => !!r.data)).toHaveLength(1)
  })

  it('bounds distinct PDF jobs globally at two, not two per request', async () => {
    const before = await db.from('report_snapshots').select('id', { count: 'exact', head: true }).eq('pdf_status', 'generating')
    const responses = await Promise.all(ids.report_snapshots.map(id => db.rpc('claim_report_pdf_generation', { p_snapshot_id: id })))
    expect(responses.every(r => !r.error)).toBe(true)
    expect(responses.filter(r => !!r.data)).toHaveLength(Math.max(0, 2 - (before.count ?? 0)))
    const after = await db.from('report_snapshots').select('id', { count: 'exact', head: true }).eq('pdf_status', 'generating')
    expect(after.count).toBeLessThanOrEqual(2)
  })

  it('retains queued work and reclaims a dead worker by dedicated lease, fencing stale completion', async () => {
    const id = ids.report_snapshots[0]
    const first = await db.rpc('claim_report_pdf_generation', { p_snapshot_id: id })
    expect(first.data).toBeTruthy()
    const stale = await db.from('report_snapshots').update({ pdf_started_at: new Date(Date.now() - 16 * 60_000).toISOString() }).eq('id', id)
    expect(stale.error).toBeNull()
    const recovered = await db.rpc('recover_report_pdf_jobs', { p_snapshot_id: id })
    expect(recovered.error).toBeNull()
    const state = await db.from('report_snapshots').select('pdf_status,pdf_attempt_count,pdf_claim_token').eq('id', id).single()
    expect(state.data).toMatchObject({ pdf_status: 'queued', pdf_attempt_count: 1, pdf_claim_token: null })
    const second = await db.rpc('claim_report_pdf_generation', { p_snapshot_id: id })
    expect(second.data).toBeTruthy()
    expect(second.data).not.toBe(first.data)
    const staleFinish = await db.from('report_snapshots').update({ pdf_status: 'ready' })
      .eq('id', id).eq('pdf_claim_token', first.data).select('id')
    expect(staleFinish.data).toEqual([])
    await db.from('report_snapshots').update({ pdf_attempt_count: 3,
      pdf_started_at: new Date(Date.now() - 16 * 60_000).toISOString() }).eq('id', id)
    await db.rpc('recover_report_pdf_jobs', { p_snapshot_id: id })
    const terminal = await db.from('report_snapshots').select('pdf_status').eq('id', id).single()
    expect(terminal.data?.pdf_status).toBe('failed')
  })

  it('bounds report generation at six across twelve concurrent triggers', async () => {
    const change = await db.from('report_snapshots').update({ status: 'pending' }).in('id', ids.report_snapshots)
    expect(change.error).toBeNull()
    const before = await db.from('report_snapshots').select('id', { count: 'exact', head: true }).eq('status', 'generating')
    const responses = await Promise.all(ids.report_snapshots.map(id => db.rpc('claim_report_snapshot_for_generation', { p_snapshot_id: id })))
    expect(responses.every(r => !r.error)).toBe(true)
    expect(responses.filter(r => r.data === true)).toHaveLength(Math.max(0, 6 - (before.count ?? 0)))
  })

  it('cannot invalidate a live PDF claim when a report is queued for regeneration', async () => {
    const id = ids.report_snapshots[0]
    const pdf = await db.rpc('claim_report_pdf_generation', { p_snapshot_id: id })
    expect(pdf.data).toBeTruthy()
    await db.from('report_snapshots').update({ status: 'pending' }).eq('id', id)
    const report = await db.rpc('claim_report_snapshot_for_generation', { p_snapshot_id: id })
    expect(report.error).toBeNull()
    expect(report.data).toBe(false)
    const state = await db.from('report_snapshots').select('pdf_status,pdf_claim_token').eq('id', id).single()
    expect(state.data).toMatchObject({ pdf_status: 'generating', pdf_claim_token: pdf.data })
  })

  it('persists exactly three attempts, delayed retries, and ignores a stale worker failure', async () => {
    const id = ids.report_snapshots[0]
    for (let attempt = 1; attempt <= 3; attempt++) {
      await db.from('report_snapshots').update({ pdf_next_attempt_at: null }).eq('id', id)
      const claimed = await db.rpc('claim_report_pdf_generation', { p_snapshot_id: id })
      expect(claimed.data).toBeTruthy()
      const stale = await db.rpc('fail_report_pdf_generation', { p_snapshot_id: id, p_claim_token: randomUUID(), p_error: 'stale' })
      expect(stale.data).toBeNull()
      const failed = await db.rpc('fail_report_pdf_generation', { p_snapshot_id: id, p_claim_token: claimed.data, p_error: 'transient render error' })
      expect(failed.error).toBeNull()
      expect(failed.data).toBe(attempt === 3 ? 'failed' : 'queued')
      // Due time, and eventually the terminal state, prevent immediate reclaims.
      expect((await db.rpc('claim_report_pdf_generation', { p_snapshot_id: id })).data).toBeNull()
    }
  })

  it('does not expose worker claims or recovery to anonymous API callers', async () => {
    const anon = createClient(url!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
    for (const name of ['claim_report_pdf_generation', 'claim_report_snapshot_for_generation']) {
      const result = await anon.rpc(name, { p_snapshot_id: ids.report_snapshots[0] })
      expect(result.error).not.toBeNull()
    }
    expect((await anon.rpc('recover_report_pdf_jobs')).error).not.toBeNull()
    expect((await anon.rpc('fail_report_pdf_generation', {
      p_snapshot_id: ids.report_snapshots[0], p_claim_token: randomUUID(), p_error: 'forged',
    })).error).not.toBeNull()
  })
})
