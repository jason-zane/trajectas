import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  reads: 0,
  allowedClients: ['client-a', 'client-b'],
  canManage: true,
  requireAccess: vi.fn(),
  rows: [] as Record<string, unknown>[],
}))
vi.mock('@/lib/auth/authorization', () => ({
  requireClientAccess: state.requireAccess,
  canManageClient: (_scope: unknown, id: string) => state.canManage && state.allowedClients.includes(id),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table !== 'user_invites') throw new Error(`Unexpected table: ${table}`)
      let rows = state.rows
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { rows = rows.filter(row => row[key] === value); return query },
        is: (key: string, value: unknown) => { rows = rows.filter(row => row[key] === value); return query },
        gt: (key: string, value: string) => {
          rows = rows.filter(row => new Date(String(row[key])).getTime() > new Date(value).getTime())
          return query
        },
        order: () => query,
        then: (resolve: (value: unknown) => unknown) => {
          state.reads++
          return Promise.resolve({ data: rows, error: null }).then(resolve)
        },
      }
      return query
    },
  }),
}))
import { getClientPendingInvites } from '@/app/actions/clients'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-06T12:00:00Z'))
  state.reads = 0
  state.canManage = true
  state.allowedClients = ['client-a', 'client-b']
  state.requireAccess.mockResolvedValue({ scope: {} })
  const pending = {
    tenant_type: 'client', tenant_id: 'client-a', role: 'client_member',
    created_at: '2026-10-05T12:00:00Z', expires_at: '2026-10-12T12:00:00Z',
    accepted_at: null, revoked_at: null,
  }
  state.rows = [
    { ...pending, id: 'pending-a', email: 'pending-a@example.com' },
    { ...pending, id: 'accepted', email: 'accepted@example.com', accepted_at: '2026-10-05T13:00:00Z' },
    { ...pending, id: 'expired', email: 'expired@example.com', expires_at: '2026-10-05T12:00:00Z' },
    { ...pending, id: 'expires-now', email: 'expires-now@example.com', expires_at: '2026-10-06T12:00:00Z' },
    { ...pending, id: 'revoked', email: 'revoked@example.com', revoked_at: '2026-10-05T13:00:00Z' },
    { ...pending, id: 'pending-b', email: 'pending-b@example.com', tenant_id: 'client-b' },
    { ...pending, id: 'partner', email: 'partner@example.com', tenant_type: 'partner' },
  ]
})
afterEach(() => vi.useRealTimers())

describe('existing client account invitation visibility', () => {
  it('returns only unaccepted, unrevoked, unexpired invitations for the requested client', async () => {
    expect(await getClientPendingInvites('client-a')).toEqual([{
      id: 'pending-a', email: 'pending-a@example.com', role: 'client_member',
      createdAt: '2026-10-05T12:00:00Z', expiresAt: '2026-10-12T12:00:00Z',
    }])
    expect(state.requireAccess).toHaveBeenCalledWith('client-a')
    expect(state.reads).toBe(1)
  })

  it('does not mix invitations across two authorized client workspaces', async () => {
    expect((await getClientPendingInvites('client-b')).map(invite => invite.email))
      .toEqual(['pending-b@example.com'])
  })

  it('retains the manager gate without reading invitations for a non-manager', async () => {
    state.canManage = false
    expect(await getClientPendingInvites('client-a')).toEqual([])
    expect(state.reads).toBe(0)
  })

  it('does not read invitations for a client outside the resolved management boundary', async () => {
    state.allowedClients = ['client-a']
    expect(await getClientPendingInvites('client-b')).toEqual([])
    expect(state.reads).toBe(0)
  })

  it('retains an access failure before querying invitation records', async () => {
    state.requireAccess.mockRejectedValue(new Error('Client access denied'))
    await expect(getClientPendingInvites('client-a')).rejects.toThrow('Client access denied')
    expect(state.reads).toBe(0)
  })
})
