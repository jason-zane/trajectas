import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthorizedScope } from '@/lib/auth/authorization'

const mocks = vi.hoisted(() => ({ access: vi.fn(), admin: vi.fn(), insert: vi.fn(), delete: vi.fn(),
  eq: vi.fn(), audit: vi.fn(), redirect: vi.fn(), revalidate: vi.fn() }))
const clientId = '11111111-1111-4111-8111-111111111111'
const partnerId = '22222222-2222-4222-8222-222222222222'
const sessionId = '33333333-3333-4333-8333-333333333333'
const templateId = '44444444-4444-4444-8444-444444444444'

vi.mock('@/lib/auth/authorization', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/auth/authorization')>(),
  requireClientAccess: mocks.access,
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.admin }))
vi.mock('@/lib/auth/support-sessions', () => ({ logAuditEvent: mocks.audit }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => {
  mocks.redirect(path)
  throw new Error('NEXT_REDIRECT')
} }))

import { createDiagnosticSession, deleteDiagnosticSession } from '@/app/actions/diagnostics'

function scope(overrides: Partial<AuthorizedScope> = {}): AuthorizedScope {
  return {
    actor: null, activeContext: null, previewContext: null, requestSurface: 'client',
    isPlatformAdmin: false, isLocalDevelopmentBypass: false, isLocalDevelopment: false,
    partnerIds: [], partnerAdminIds: [], clientIds: [clientId], clientAdminIds: [], managedClientIds: [],
    supportSession: null, ...overrides,
  }
}
function form() {
  const data = new FormData()
  data.set('clientId', clientId)
  data.set('templateId', templateId)
  data.set('title', 'Diagnostic permission fixture')
  return data
}
beforeEach(() => {
  mocks.access.mockResolvedValue({ scope: scope(), clientId })
  mocks.audit.mockResolvedValue(undefined)
  mocks.admin.mockImplementation(() => ({ from: (table: string) => {
    expect(table).toBe('diagnostic_sessions')
    const query: Record<string, unknown> = {}
    query.select = () => query
    query.eq = (...args: unknown[]) => { mocks.eq(...args); return query }
    query.insert = (row: unknown) => { mocks.insert(row); return query }
    query.delete = () => { mocks.delete(); return query }
    query.single = async () => ({ data: { id: sessionId, client_id: clientId }, error: null })
    query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve)
    return query
  } }))
})

describe('diagnostic session management permissions', () => {
  it.each(['client', 'partner'])('denies creation by a read-only %s member before creating a service client', async membership => {
    mocks.access.mockResolvedValue({ scope: scope({ partnerIds: membership === 'partner' ? [partnerId] : [] }), clientId })
    expect(await createDiagnosticSession(form())).toEqual({ error: { _form: [expect.stringMatching(/permission to manage diagnostics/)] } })
    expect(mocks.access).toHaveBeenCalledWith(clientId)
    expect(mocks.admin).not.toHaveBeenCalled()
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.audit).not.toHaveBeenCalled()
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it.each(['client', 'partner'])('denies deletion by a read-only %s member after lookup but before mutation', async membership => {
    mocks.access.mockResolvedValue({ scope: scope({ partnerIds: membership === 'partner' ? [partnerId] : [] }), clientId })
    expect(await deleteDiagnosticSession(sessionId)).toEqual({ error: expect.stringMatching(/permission to manage diagnostics/) })
    expect(mocks.access).toHaveBeenCalledWith(clientId)
    expect(mocks.delete).not.toHaveBeenCalled()
    expect(mocks.audit).not.toHaveBeenCalled()
    expect(mocks.revalidate).not.toHaveBeenCalled()
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it.each(['client', 'partner', 'platform'])('allows the authorised %s admin to create a session', async membership => {
    mocks.access.mockResolvedValue({ scope: scope({
      isPlatformAdmin: membership === 'platform', managedClientIds: membership === 'platform' ? [] : [clientId],
      clientAdminIds: membership === 'client' ? [clientId] : [], partnerAdminIds: membership === 'partner' ? [partnerId] : [],
    }), clientId })
    await expect(createDiagnosticSession(form())).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ client_id: clientId, template_id: templateId }))
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'diagnostic_session.created', clientId }))
    expect(mocks.redirect).toHaveBeenCalledWith('/diagnostics')
  })

  it.each(['client', 'partner', 'platform'])('allows the authorised %s admin to delete only within the checked client', async membership => {
    mocks.access.mockResolvedValue({ scope: scope({
      isPlatformAdmin: membership === 'platform', managedClientIds: membership === 'platform' ? [] : [clientId],
      clientAdminIds: membership === 'client' ? [clientId] : [], partnerAdminIds: membership === 'partner' ? [partnerId] : [],
    }), clientId })
    await expect(deleteDiagnosticSession(sessionId)).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.delete).toHaveBeenCalledOnce()
    expect(mocks.eq).toHaveBeenCalledWith('client_id', clientId)
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'diagnostic_session.deleted', targetId: sessionId, clientId }))
    expect(mocks.redirect).toHaveBeenCalledWith('/diagnostics')
  })

  it('does not treat an admin role outside the managed client scope as permission', async () => {
    mocks.access.mockResolvedValue({ scope: scope({ partnerIds: [partnerId], partnerAdminIds: [partnerId], managedClientIds: [] }), clientId })
    expect(await createDiagnosticSession(form())).toHaveProperty('error')
    expect(await deleteDiagnosticSession(sessionId)).toHaveProperty('error')
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.delete).not.toHaveBeenCalled()
  })
})
