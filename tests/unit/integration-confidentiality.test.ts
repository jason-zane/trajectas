/* eslint-disable @typescript-eslint/no-explicit-any -- fluent database fixture */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import type { IntegrationAuthContext } from '@/lib/integrations/types'

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), sendEmail: vi.fn(), event: vi.fn(), queries: [] as any[] }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: (table: string) => {
  const query = { table, operation: 'select', values: null as any, filters: [] as any[] }
  const chain: any = {}
  for (const name of ['select', 'order', 'limit']) chain[name] = () => chain
  for (const name of ['eq', 'in', 'is', 'lte']) chain[name] = (...args: any[]) => { query.filters.push([name, ...args]); return chain }
  for (const name of ['insert', 'update']) chain[name] = (values: any) => { query.operation = name; query.values = values; return chain }
  const finish = async () => { mocks.queries.push(query); return mocks.resolve(query) ?? { data: null, error: null } }
  chain.single = finish; chain.maybeSingle = finish
  chain.then = (resolve: any, reject: any) => finish().then(resolve, reject)
  return chain
} }) }))
vi.mock('@/lib/auth/support-sessions', () => ({ logAuditEvent: async () => {} }))
vi.mock('@/lib/integrations/events', () => ({ enqueueIntegrationEvent: (...args: any[]) => mocks.event(...args) }))
vi.mock('@/lib/email/send', () => ({ sendEmail: (...args: any[]) => mocks.sendEmail(...args) }))
vi.mock('@/lib/integrations/crypto', () => ({ decryptIntegrationSecret: () => 'local-unit-test-signing-key' }))
vi.mock('@/lib/hosts', () => ({ buildSurfaceUrl: (_surface: string, path: string) => new URL(path, 'https://assess.example.invalid'), requireAppUrl: () => 'https://example.invalid' }))

import { createIntegrationLaunch, getIntegrationLaunch, getIntegrationParticipantResultSummary, upsertIntegrationParticipant } from '@/lib/integrations/service'
import { redactIntegrationParticipantCredentials } from '@/lib/integrations/confidentiality'
import { withIntegrationApiRoute } from '@/lib/integrations/auth'
import { hashIntegrationApiKey } from '@/lib/integrations/credentials'
import { dispatchPendingIntegrationEvents } from '@/lib/integrations/webhooks'

const campaignId = '11111111-1111-4111-8111-111111111111'
const context: IntegrationAuthContext = { requestId: 'request', clientId: 'client', connectionId: 'connection',
  connectionProvider: 'internal', credentialId: 'credential', credentialLabel: 'fixture', scopes: ['participants:write'] }
const campaign = { id: campaignId, client_id: 'client', title: 'Private campaign', slug: 'private', confidentiality_mode: 'aggregate_only' }
const participant = { id: 'participant', campaign_id: campaignId, email: 'participant@example.invalid',
  access_token: 'PRIVATE_PARTICIPANT_TOKEN', status: 'invited', campaigns: campaign }
const legacyLaunch = { id: 'launch', client_id: 'client', campaign_id: campaignId, campaign_participant_id: 'participant',
  delivery_method: 'email', status: 'delivered', assessment_url: 'https://assess.example.invalid/assess/PRIVATE_PARTICIPANT_TOKEN' }
const result = (data: unknown) => ({ data, error: null })

beforeEach(() => {
  mocks.queries.length = 0
  mocks.event.mockResolvedValue(undefined)
  mocks.sendEmail.mockResolvedValue(undefined)
})

describe('aggregate-only integration confidentiality', () => {
  it('removes credentials from nested historical response envelopes', () => {
    const redacted = redactIntegrationParticipantCredentials({ participant: { id: 'p', accessToken: 'secret' },
      launch: { assessmentUrl: 'secret' }, rows: [{ access_token: 'secret', id: 'safe' }] })
    expect(redacted).toEqual({ participant: { id: 'p' }, launch: {}, rows: [{ id: 'safe' }] })
  })

  it('refuses individual summaries before querying scores', async () => {
    mocks.resolve.mockReturnValue(result(participant))
    await expect(getIntegrationParticipantResultSummary(context, 'participant')).rejects.toMatchObject({ status: 403 })
    expect(mocks.queries.map(q => q.table)).toEqual(['campaign_participants'])
  })

  it('redacts new participant registration credentials', async () => {
    mocks.resolve.mockImplementation((q: any) => q.table === 'campaigns' ? result(campaign)
      : result(q.operation === 'insert' ? participant : null))
    const response = await upsertIntegrationParticipant(context, campaignId, { email: participant.email })
    expect(response.created).toBe(true)
    expect(response.assessmentUrl).toBeNull()
    expect(JSON.stringify(response)).not.toContain(participant.access_token)
  })

  it('refreshes confidentiality after enrollment if the initial empty-campaign read was stale', async () => {
    let campaignReads = 0
    mocks.resolve.mockImplementation((q: any) => q.table === 'campaigns'
      ? result({ ...campaign, confidentiality_mode: ++campaignReads === 1 ? 'standard' : 'aggregate_only' })
      : result(q.operation === 'insert' ? participant : null))
    const response = await upsertIntegrationParticipant(context, campaignId, { email: participant.email })
    expect(campaignReads).toBe(2)
    expect(response.assessmentUrl).toBeNull()
    expect(JSON.stringify(response)).not.toContain(participant.access_token)
  })

  it('prevents changing an existing participant email to capture their private invitation', async () => {
    mocks.resolve.mockImplementation((q: any) => q.table === 'campaigns' ? result(campaign)
      : q.table === 'integration_external_refs' ? result({ local_id: 'participant' }) : result(participant))
    await expect(upsertIntegrationParticipant(context, campaignId, { email: 'attacker@example.invalid',
      externalRefs: [{ sourceSystem: 'test', remoteObjectType: 'person', remoteId: 'person' }] })).rejects.toMatchObject({ status: 403 })
    expect(mocks.queries.some(q => q.operation === 'update')).toBe(false)
  })

  it('refuses link delivery before creating a launch', async () => {
    mocks.resolve.mockReturnValue(result(campaign))
    await expect(createIntegrationLaunch(context, campaignId, { participantId: 'participant', deliveryMethod: 'link' }))
      .rejects.toMatchObject({ status: 403 })
    expect(mocks.queries.map(q => q.table)).toEqual(['campaigns'])
  })

  it('keeps private email delivery working without retaining the URL in launch, event or response', async () => {
    mocks.resolve.mockImplementation((q: any) => q.table === 'campaigns' ? result(campaign)
      : q.table === 'campaign_participants' ? result(participant) : result(legacyLaunch))
    const response = await createIntegrationLaunch(context, campaignId, { participantId: 'participant', deliveryMethod: 'email' })
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: participant.email,
      variables: expect.objectContaining({ assessmentUrl: expect.stringContaining(participant.access_token) }) }))
    const stored = mocks.queries.find(q => q.table === 'integration_launches' && q.operation === 'insert')
    expect(stored.values.assessment_url).toBe('redacted:participant-email-delivery')
    expect(JSON.stringify(response)).not.toContain(participant.access_token)
    expect(JSON.stringify(mocks.event.mock.calls)).not.toContain(participant.access_token)
  })

  it('redacts a legacy launch after the campaign changes to aggregate-only', async () => {
    mocks.resolve.mockImplementation((q: any) => result(q.table === 'campaigns' ? campaign : legacyLaunch))
    expect((await getIntegrationLaunch(context, 'launch')).assessmentUrl).toBeNull()
  })

  it('re-evaluates current confidentiality when replaying an old idempotent response', async () => {
    vi.stubEnv('INTERNAL_INTEGRATIONS_API_ENABLED', 'true')
    vi.stubEnv('INTEGRATIONS_API_SECRET_PEPPER', 'local-test-pepper')
    const apiKey = `tfi.${'a'.repeat(12)}.${'b'.repeat(32)}`
    const path = `/api/internal/v1/campaigns/${campaignId}/participants/upsert`
    const body = JSON.stringify({ email: participant.email })
    const requestHash = createHash('sha256').update(`POST:${path}:${body}`).digest('hex')
    mocks.resolve.mockImplementation((q: any) => {
      if (q.table === 'integration_credentials') return result({ id: 'credential', client_id: 'client', status: 'active',
        secret_hash: hashIntegrationApiKey(apiKey), scopes: ['participants:write'],
        integration_connections: { id: 'connection', client_id: 'client', status: 'active' } })
      if (q.table === 'campaigns') return result(campaign)
      if (q.operation === 'insert') return { data: null, error: { code: '23505' } }
      return result({ request_hash: requestHash, status: 'completed', response_status: 201,
        response_body: { participant: { accessToken: participant.access_token }, assessmentUrl: legacyLaunch.assessment_url } })
    })
    const handler = vi.fn()
    const response = await withIntegrationApiRoute(new Request(`https://example.invalid${path}`, { method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Idempotency-Key': 'retry-fixture' }, body }),
      { scopes: ['participants:write'], enableIdempotency: true }, handler)
    expect(response.status).toBe(201)
    expect(response.headers.get('X-Idempotent-Replay')).toBe('true')
    expect(await response.text()).not.toContain(participant.access_token)
    expect(handler).not.toHaveBeenCalled()
  })

  it('redacts a pending legacy webhook using current campaign policy before signing and sending', async () => {
    const fetch = vi.fn(async () => new Response('ok'))
    vi.stubGlobal('fetch', fetch)
    mocks.resolve.mockImplementation((q: any) => {
      if (q.table === 'campaigns') return result(campaign)
      if (q.table === 'integration_events_outbox') return result([{ id: 'event', client_id: 'client',
        event_type: 'integration.launch.created', payload: { campaignId, assessmentUrl: legacyLaunch.assessment_url } }])
      if (q.table === 'integration_webhook_endpoints' && q.operation === 'select') return result([{ id: 'endpoint',
        url: 'https://webhook.example.invalid', signing_secret_ciphertext: 'fixture', subscribed_events: [] }])
      return result(null)
    })
    expect(await dispatchPendingIntegrationEvents(1)).toMatchObject({ delivered: 1 })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(fetch.mock.calls)).not.toContain(participant.access_token)
  })
})
