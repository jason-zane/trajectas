import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ access: vi.fn(), manage: vi.fn(), connection: vi.fn(), mutation: vi.fn(), audit: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/features/access', () => ({ requireWorkspaceFeature: vi.fn() }))
vi.mock('@/lib/auth/authorization', () => ({
  requireClientAccess: mocks.access, canManageClient: mocks.manage,
  AuthorizationError: class extends Error {},
}))
vi.mock('@/lib/auth/support-sessions', () => ({ logAuditEvent: mocks.audit }))
vi.mock('@/lib/integrations/credentials', () => ({ ensureInternalIntegrationConnection: mocks.connection, issueIntegrationCredential: vi.fn() }))
vi.mock('@/lib/integrations/crypto', () => ({ encryptIntegrationSecret: () => 'encrypted-fixture' }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: () => {
  const chain = {
    insert: (value: unknown) => { mocks.mutation(value); return chain },
    update: (value: unknown) => { mocks.mutation(value); return chain },
    select: () => chain, eq: () => chain,
    single: async () => ({ data: { id: 'endpoint' }, error: null }),
    then: (resolve: (result: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
  }
  return chain
} }) }))

import { createInternalWebhookEndpointAction, updateInternalWebhookEndpointAction } from '@/app/actions/integrations'

const input = { clientId: '11111111-1111-4111-8111-111111111111', clientSlug: 'fixture', label: 'Webhook', url: 'https://hooks.example.com/events', subscribedEvents: ['integration.launch.created' as const] }
const update = { ...input, endpointId: '22222222-2222-4222-8222-222222222222', status: 'active' as const }

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.access.mockResolvedValue({ clientId: input.clientId, partnerId: null, scope: { actor: { id: 'actor' } } })
  mocks.manage.mockReturnValue(true)
  mocks.connection.mockResolvedValue('connection')
})

describe('webhook endpoint action validation', () => {
  it.each([
    'http://localhost:8080/events', 'http://127.0.0.1/events', 'https://localhost/events',
    'https://10.0.0.1/events', 'https://169.254.169.254/events',
    'https://[::ffff:127.0.0.1]/events', 'https://user:pass@hooks.example.com/events',
  ])('rejects unsafe URLs through both actual actions before persistence: %s', async url => {
    expect(await createInternalWebhookEndpointAction({ ...input, url })).toHaveProperty('error')
    expect(await updateInternalWebhookEndpointAction({ ...update, url })).toHaveProperty('error')
    expect(mocks.mutation).not.toHaveBeenCalled()
    expect(mocks.connection).not.toHaveBeenCalled()
    expect(mocks.audit).not.toHaveBeenCalled()
  })

  it('retains authorised public HTTPS endpoint creation and tenant ownership', async () => {
    expect(await createInternalWebhookEndpointAction(input)).toMatchObject({ success: true })
    expect(mocks.mutation).toHaveBeenCalledWith(expect.objectContaining({ client_id: input.clientId, url: input.url }))
    expect(await updateInternalWebhookEndpointAction(update)).toEqual({ success: true })
  })

  it('keeps the management authorisation gate before URL validation and writes', async () => {
    mocks.manage.mockReturnValue(false)
    expect(await createInternalWebhookEndpointAction(input)).toHaveProperty('error')
    expect(mocks.mutation).not.toHaveBeenCalled()
  })

  it('keeps local HTTP endpoints available only outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(await createInternalWebhookEndpointAction({ ...input, url: 'http://localhost:8080/events' })).toMatchObject({ success: true })
  })
})
