/* eslint-disable @typescript-eslint/no-explicit-any -- synthetic local load fixture */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { createAssessSessionProof } from '@/lib/assess/session-proof'
import { checkRequestRateLimit } from '@/lib/security/rate-limit'
import { getOrCreateSectionForms } from '@/lib/dal/session-forms'

const fixtureErrors = vi.hoisted(() => [] as string[])
vi.mock('@/lib/observability/report-error', () => ({ reportError: async (error: { code?: string; message?: string }) => {
  fixtureErrors.push(`${error?.code ?? ''}: ${error?.message ?? 'unknown local fixture error'}`)
} }))
// Actual route and its actual Supabase client/RPC; no persistence mocks.
import { POST } from '@/app/api/assess/save-batch/route'

const isLocalSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL === 'http://127.0.0.1:54321'
const canRun = process.env.CAPACITY_DB === '1' && isLocalSupabase
const target = process.env.NEXT_PUBLIC_SUPABASE_URL
if (process.env.CAPACITY_DB === '1' && !isLocalSupabase) throw new Error('Local Supabase loopback URL required')
const PARTICIPANTS = 100
const ITEMS = 20
const prefix = `capacity-${Date.now()}-${randomUUID().slice(0, 8)}`

describe.skipIf(!canRun)('actual save-batch handler and local Supabase: 100 sessions', () => {
  const nativeFetch = globalThis.fetch
  const ids: Record<string, string[]> = {}
  let sessions: Array<{ id: string; token: string }> = []
  let itemIds: string[] = []
  let db: SupabaseClient
  const latencies: number[] = []

  async function insert(table: string, rows: any | any[]) {
    const { data, error } = await db.from(table).insert(rows).select('*')
    if (error) throw new Error(`Fixture insert ${table}: ${error.code} ${error.message}`)
    ids[table] = [...(ids[table] || []), ...data.map((r: any) => r.id)]
    return data
  }
  async function batch(session: { id: string; token: string }, item: string, value: number) {
    const began = performance.now()
    const proof = createAssessSessionProof(session.token, session.id)!
    const request = new NextRequest('http://127.0.0.1/api/assess/save-batch', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.20', 'x-assess-session-proof': proof },
      body: JSON.stringify({ token: session.token, sessionId: session.id,
        saves: [{ itemId: item, responseValue: value, responseTimeMs: 5000, idempotencyKey: `${session.id}:${item.slice(0, 12)}` }] }),
    })
    expect((await checkRequestRateLimit(request))?.allowed).toBe(true)
    const response = await POST(request)
    latencies.push(performance.now() - began)
    expect(response.status).toBe(200)
    const responseBody = await response.json()
    expect(responseBody.savedItemIds, JSON.stringify(responseBody)).toEqual([item])
  }
  function guardNetwork() {
    // Fail closed for EVERY HTTP request, including accidental report/email/Redis paths.
    vi.stubGlobal('fetch', (input: any, init: any) => {
      const url = new URL(typeof input === 'string' ? input : input.url ?? input.toString())
      if (url.origin !== target) throw new Error('Non-local network call forbidden by capacity harness')
      return nativeFetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(15000) }).catch(error => {
        // Error codes only: never include headers, URLs with tokens, or credentials.
        fixtureErrors.push(`transport:${error?.code ?? error?.name}:${error?.cause?.code ?? error?.cause?.name ?? 'unknown'}`)
        throw error
      })
    })
  }
  beforeEach(() => {
    guardNetwork()
    vi.stubEnv('INTERNAL_API_KEY', 'local-capacity-test-only')
  })
  beforeAll(async () => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Local service key required')
    guardNetwork()
    db = createClient(target!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const [client] = await insert('clients', { name: prefix, slug: prefix })
    const [campaign] = await insert('campaigns', { title: prefix, slug: prefix, client_id: client.id, status: 'active' })
    const [assessment] = await insert('assessments', { title: prefix, slug: prefix })
    const [format] = await insert('response_formats', { name: prefix, type: 'likert', config: { scale: 5 } })
    const [section] = await insert('assessment_sections', { assessment_id: assessment.id,
      response_format_id: format.id, title: prefix, display_order: 0, allow_back_nav: true })
    const items = await insert('items', Array.from({ length: ITEMS }, (_, i) => ({
      stem: `${prefix} item ${i}`, response_format_id: format.id, purpose: 'impression_management',
    })))
    itemIds = items.map((r: any) => r.id)
    await insert('assessment_section_items', itemIds.map((id, i) => ({ section_id: section.id, item_id: id, display_order: i })))
    await insert('campaign_assessments', { campaign_id: campaign.id, assessment_id: assessment.id, display_order: 0 })
    const participants = await insert('campaign_participants', Array.from({ length: PARTICIPANTS }, (_, i) => ({
      campaign_id: campaign.id, email: `${prefix}-${i}@test.local`, first_name: 'Synthetic capacity fixture',
    })))
    const inserted = await insert('participant_sessions', participants.map((p: any) => ({
      campaign_participant_id: p.id, campaign_id: campaign.id, assessment_id: assessment.id,
      client_id: client.id, status: 'in_progress', started_at: new Date().toISOString(),
    })))
    sessions = inserted.map((s: any) => ({ id: s.id, token: participants.find((p: any) => p.id === s.campaign_participant_id).access_token }))
    expect(sessions).toHaveLength(PARTICIPANTS)
  }, 30_000)
  afterAll(async () => {
    const errors: string[] = []
    // Delete only ids generated by THIS run. Never reset the local database.
    for (const table of ['participant_sessions', 'campaign_participants', 'campaign_assessments',
      'campaigns', 'clients', 'assessment_section_items', 'assessment_sections', 'assessments', 'items', 'response_formats']) {
      if (!db || !ids[table]?.length) continue
      const { error } = await db.from(table).delete().in('id', ids[table])
      if (error) errors.push(`${table}: ${error.code} ${error.message}`)
    }
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    if (errors.length) throw new Error(`Fixture cleanup requires attention (${prefix}): ${errors.join('; ')}`)
  })

  async function initializeForms(selected: typeof sessions) {
    return Promise.allSettled(selected.map(session => getOrCreateSectionForms(db, {
      sessionId: session.id, assessmentId: ids.assessments[0], campaignId: ids.campaigns[0],
    })))
  }

  it('freezes 100 cold participant forms concurrently through the real local delivery DAL', async () => {
    const began = performance.now()
    const forms = await initializeForms(sessions)
    const succeeded = forms.filter(form => form.status === 'fulfilled' && !('error' in form.value)).length
    console.log(JSON.stringify({ scenario: 'local_cold_form_initialization', participants: PARTICIPANTS,
      succeeded, elapsedMs: Math.round(performance.now() - began), transportErrors: [...new Set(fixtureErrors)] }))
    expect(succeeded, [...new Set(fixtureErrors)].join('; ')).toBe(PARTICIPANTS)
    const stored = await db.from('participant_section_forms').select('session_id,entry_count')
      .in('session_id', sessions.map(session => session.id))
    expect(stored.error).toBeNull()
    expect(stored.data).toHaveLength(PARTICIPANTS)
    expect(stored.data?.every(form => form.entry_count === ITEMS)).toBe(true)
  }, 30_000)

  it('persists 2000 exact answers through 100 concurrent writers, then replays without duplicates', async () => {
    // The separate cold-start test remains a hard assertion. Prepare/reuse
    // fixture forms here so its result cannot obscure answer-save performance.
    for (let offset = 0; offset < sessions.length; offset += 10) {
      const forms = await initializeForms(sessions.slice(offset, offset + 10))
      expect(forms.every(form => form.status === 'fulfilled' && !('error' in form.value)),
        [...new Set(fixtureErrors)].join('; ')).toBe(true)
    }
    async function round(itemId: string, value: number) {
      // Always wait for every writer before assertions can trigger fixture cleanup.
      const results = await Promise.allSettled(sessions.map(s => batch(s, itemId, value)))
      const failed = results.find(result => result.status === 'rejected')
      if (failed?.status === 'rejected') throw failed.reason
    }
    const began = performance.now()
    for (let i = 0; i < ITEMS; i++) {
      await round(itemIds[i], i % 5 + 1)
    }
    const elapsedMs = performance.now() - began
    await round(itemIds[0], 1)
    const { count, error } = await db.from('participant_responses')
      .select('id', { count: 'exact', head: true }).in('session_id', sessions.map(s => s.id))
    expect(error).toBeNull()
    expect(count).toBe(PARTICIPANTS * ITEMS)
    let checked = 0
    for (let offset = 0; offset < count!; offset += 500) {
      const result = await db.from('participant_responses').select('session_id,item_id,response_value')
        .in('session_id', sessions.map(s => s.id)).order('id').range(offset, offset + 499)
      expect(result.error).toBeNull()
      for (const row of result.data!) {
        expect(Number(row.response_value)).toBe(itemIds.indexOf(row.item_id) % 5 + 1)
        checked++
      }
    }
    expect(checked).toBe(PARTICIPANTS * ITEMS)
    const sorted = [...latencies].sort((a, b) => a - b)
    const percentile = (p: number) => Math.round(sorted[Math.ceil(sorted.length * p) - 1] * 100) / 100
    console.log(JSON.stringify({ scenario: 'local_handler_supabase_100_writers', participants: PARTICIPANTS,
      answers: count, requestsIncludingReplays: latencies.length, elapsedMs: Math.round(elapsedMs),
      answersPerSecond: Math.round(count! / (elapsedMs / 1000)), p50Ms: percentile(.5), p95Ms: percentile(.95),
      p99Ms: percentile(.99), duplicates: 0, verifiedValues: checked,
      caveat: 'Handler plus local HTTP DB only; includes real limiter with signed session proof; forms prepared 10 at a time; bypasses cold-start delivery, Next HTTP ingress, UI, scoring and reports. Burst benchmark, not production proof.' }))
  }, 30_000)
})
