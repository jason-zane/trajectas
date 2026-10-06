import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  profiles: [] as Record<string, unknown>[],
  queries: [] as { source: string; table: string; predicates: [string, string, unknown][]; limit?: number }[],
  inserts: 0,
  requireAdmin: vi.fn(),
  requireClient: vi.fn(),
  requirePartner: vi.fn(),
  canManage: true,
  sendEmail: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({
  requireAdminScope: state.requireAdmin,
  requireClientAccess: state.requireClient,
  requirePartnerAccess: state.requirePartner,
  canManageClient: () => state.canManage,
}))
vi.mock('@/lib/auth/support-sessions', () => ({ logAuditEvent: vi.fn() }))
vi.mock('@/lib/auth/staff-invite-email', () => ({ sendStaffInviteEmail: state.sendEmail }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: (table: string) => makeQuery(table, 'admin') }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: (table: string) => makeQuery(table, 'session') }) }))

function makeQuery(table: string, source: string) {
  let rows = table === 'user_invites' ? [...state.rows] : table === 'profiles' ? [...state.profiles] : []
  let inserting = false
  const read = { table, source, predicates: [] as [string, string, unknown][], limit: undefined as number | undefined }
  const consume = (single = false) => {
    state.queries.push(read)
    return inserting
      ? { data: null, error: { code: '23505', message: 'synthetic active-scope collision' } }
      : { data: single ? rows[0] ?? null : rows, error: null }
  }
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => {
      read.predicates.push(['eq', key, value])
      rows = rows.filter(row => key === 'email'
        ? String(row[key]).toLowerCase() === String(value).toLowerCase()
        : row[key] === value)
      return query
    },
    is: (key: string, value: unknown) => {
      read.predicates.push(['is', key, value])
      rows = rows.filter(row => row[key] === value)
      return query
    },
    gt: (key: string, value: string) => {
      read.predicates.push(['gt', key, value])
      rows = rows.filter(row => new Date(String(row[key])).getTime() > new Date(value).getTime())
      return query
    },
    in: () => query,
    order: (key: string, options: { ascending: boolean }) => {
      rows.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (options.ascending ? 1 : -1))
      return query
    },
    limit: (count: number) => { read.limit = count; rows = rows.slice(0, count); return query },
    insert: () => { state.inserts++; inserting = true; return query },
    maybeSingle: () => Promise.resolve(consume(true)),
    single: () => Promise.resolve(consume(true)),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(consume()).then(resolve),
  }
  return query
}

import { getClientPendingInvites, inviteUserToClient } from '@/app/actions/clients'
import { getPartnerPendingInvites, inviteUserToPartner } from '@/app/actions/partners'
import { listUsersForAdmin } from '@/app/actions/user-management'
import { EXISTING_INVITE_ERROR, getInviteStatus, OUTSTANDING_INVITE_LIMIT, PENDING_INVITE_ERROR } from '@/lib/invite-status'

const clientId = '00000000-0000-4000-8000-000000000001'
const otherClientId = '00000000-0000-4000-8000-000000000002'
const partnerId = '00000000-0000-4000-8000-000000000011'
const now = new Date('2026-10-06T12:00:00.000Z')
const baseInvite = {
  id: 'existing-invite', email: 'person@example.com', tenant_type: 'client', tenant_id: clientId,
  role: 'client_member', accepted_at: null, revoked_at: null,
  created_at: '2026-09-20T12:00:00.000Z', expires_at: '2026-09-27T12:00:00.000Z',
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  state.rows = [{ ...baseInvite }]
  state.profiles = []
  state.queries = []
  state.inserts = 0
  state.canManage = true
  const scope = { actor: { id: '00000000-0000-4000-8000-000000000003' }, isPlatformAdmin: true, partnerAdminIds: [partnerId] }
  state.requireAdmin.mockResolvedValue(scope)
  state.requireClient.mockResolvedValue({ scope })
  state.requirePartner.mockResolvedValue({ scope })
})
afterEach(() => vi.useRealTimers())

describe('outstanding account invitation reads', () => {
  it('shows expired and pending invitations globally without hiding an invite behind a profile or missing tenant name', async () => {
    state.rows = [
      { ...baseInvite, id: 'expired' },
      { ...baseInvite, id: 'pending', expires_at: '2026-10-07T12:00:00Z' },
      { ...baseInvite, id: 'accepted', accepted_at: '2026-09-21T12:00:00Z' },
      { ...baseInvite, id: 'revoked', revoked_at: '2026-09-21T12:00:00Z' },
    ]
    state.profiles = [{
      id: 'profile-existing', email: baseInvite.email, display_name: 'Existing person',
      first_name: null, last_name: null, role: 'org_admin', is_active: true,
      created_at: baseInvite.created_at, scheduled_deletion_at: null,
    }]
    const users = await listUsersForAdmin()
    expect(users.filter(user => user.type === 'invite').map(user => user.id).sort()).toEqual(['expired', 'pending'])
    expect(users.filter(user => user.email === baseInvite.email)).toHaveLength(3)
    expect(users.filter(user => user.type === 'invite').map(invite => getInviteStatus(invite)).sort()).toEqual(['expired', 'pending'])
    expect(state.requireAdmin).toHaveBeenCalledOnce()
    const read = state.queries.find(query => query.table === 'user_invites')!
    expect(read.limit).toBe(OUTSTANDING_INVITE_LIMIT)
    expect(read.predicates).toEqual([['is', 'accepted_at', null], ['is', 'revoked_at', null]])
  })

  it.each(['client', 'partner'] as const)('includes expired %s invites while preserving tenant and status predicates', async tenantType => {
    const id = tenantType === 'client' ? clientId : partnerId
    const row = { ...baseInvite, tenant_type: tenantType, tenant_id: id, role: `${tenantType}_member` }
    state.rows = [
      { ...row, id: 'expired' },
      { ...row, id: 'pending', expires_at: '2026-10-07T12:00:00Z' },
      { ...row, id: 'accepted', accepted_at: now.toISOString() },
      { ...row, id: 'revoked', revoked_at: now.toISOString() },
      { ...row, id: 'wrong-workspace', tenant_id: otherClientId },
      { ...row, id: 'wrong-type', tenant_type: tenantType === 'client' ? 'partner' : 'client' },
    ]
    const invites = tenantType === 'client' ? await getClientPendingInvites(id) : await getPartnerPendingInvites(id)
    expect(invites.map(invite => invite.id).sort()).toEqual(['expired', 'pending'])
    expect(invites.map(invite => getInviteStatus(invite)).sort()).toEqual(['expired', 'pending'])
    expect(state.queries[0].predicates).toEqual([
      ['eq', 'tenant_type', tenantType], ['eq', 'tenant_id', id],
      ['is', 'accepted_at', null], ['is', 'revoked_at', null],
    ])
    expect(state.queries[0].source).toBe(tenantType === 'client' ? 'admin' : 'session')
    expect(state.queries[0].limit).toBe(OUTSTANDING_INVITE_LIMIT)
    expect(state.inserts).toBe(0)
    expect(state.sendEmail).not.toHaveBeenCalled()
  })

  it('bounds the outstanding read and returns the newest rows first', async () => {
    state.rows = Array.from({ length: OUTSTANDING_INVITE_LIMIT + 5 }, (_, index) => ({
      ...baseInvite, id: `invite-${index}`, created_at: new Date(now.getTime() + index * 1000).toISOString(),
    }))
    const invites = await getClientPendingInvites(clientId)
    expect(invites).toHaveLength(OUTSTANDING_INVITE_LIMIT)
    expect(invites[0].id).toBe(`invite-${OUTSTANDING_INVITE_LIMIT + 4}`)
    expect(state.queries).toHaveLength(1)
  })

  it('keeps the global administrator gate before reading invites', async () => {
    state.requireAdmin.mockRejectedValue(new Error('Administrator required'))
    await expect(listUsersForAdmin()).rejects.toThrow('Administrator required')
    expect(state.queries).toHaveLength(0)
  })

  it('keeps the partner manager gate before reading invites', async () => {
    state.requirePartner.mockResolvedValue({ scope: { isPlatformAdmin: false, partnerAdminIds: [] } })
    expect(await getPartnerPendingInvites(partnerId)).toEqual([])
    expect(state.queries).toHaveLength(0)
  })
})

describe('duplicate detection and list consistency with synthetic records', () => {
  it.each(['client', 'partner'] as const)('keeps an expired %s collision visible without sending email', async tenantType => {
    const id = tenantType === 'client' ? clientId : partnerId
    state.rows = [{ ...baseInvite, tenant_type: tenantType, tenant_id: id, role: `${tenantType}_member` }]
    const result = tenantType === 'client'
      ? await inviteUserToClient(id, { email: ' PERSON@EXAMPLE.COM ', role: 'member' })
      : await inviteUserToPartner(id, { email: ' PERSON@EXAMPLE.COM ', role: 'member' })
    expect(result).toEqual({ error: EXISTING_INVITE_ERROR, duplicate: { inviteId: 'existing-invite' } })
    if (!('duplicate' in result) || !result.duplicate) throw new Error('Expected duplicate result')
    // One synthetic failed insert exercises the existing unique-collision path.
    expect(state.inserts).toBe(1)
    expect(state.sendEmail).not.toHaveBeenCalled()
    const lookup = state.queries[2]
    expect(lookup.predicates).toContainEqual(['eq', 'email', 'person@example.com'])
    expect(lookup.predicates.some(predicate => predicate[1] === 'expires_at')).toBe(false)
    const invites = tenantType === 'client' ? await getClientPendingInvites(id) : await getPartnerPendingInvites(id)
    expect(invites.map(invite => invite.id)).toContain(result.duplicate!.inviteId)
    expect(getInviteStatus(invites[0])).toBe('expired')
  })

  it.each(['client', 'partner'] as const)('preserves the unexpired %s precheck across selected roles', async tenantType => {
    const id = tenantType === 'client' ? clientId : partnerId
    state.rows = [{ ...baseInvite, tenant_type: tenantType, tenant_id: id, role: `${tenantType}_admin`, expires_at: '2026-10-07T12:00:00Z' }]
    const result = tenantType === 'client'
      ? await inviteUserToClient(id, { email: ' PERSON@EXAMPLE.COM ', role: 'member' })
      : await inviteUserToPartner(id, { email: ' PERSON@EXAMPLE.COM ', role: 'member' })
    expect(result).toEqual({ error: PENDING_INVITE_ERROR, duplicate: { inviteId: 'existing-invite' } })
    if (!('duplicate' in result) || !result.duplicate) throw new Error('Expected duplicate result')
    expect(state.inserts).toBe(0)
    expect(state.sendEmail).not.toHaveBeenCalled()
    expect(state.queries[0].predicates).toContainEqual(['eq', 'email', 'person@example.com'])
    expect(state.queries[0].predicates.some(predicate => predicate[1] === 'role')).toBe(false)
    const invites = tenantType === 'client' ? await getClientPendingInvites(id) : await getPartnerPendingInvites(id)
    expect(invites[0].id).toBe(result.duplicate!.inviteId)
    expect(getInviteStatus(invites[0])).toBe('pending')
  })
})

describe('invitation expiry boundary', () => {
  it.each([
    ['2026-10-06T11:59:59.999Z', 'expired'],
    ['2026-10-06T12:00:00.000Z', 'expired'],
    ['2026-10-06T12:00:00.001Z', 'pending'],
  ])('classifies %s as %s', (expiresAt, expected) => {
    expect(getInviteStatus({ expiresAt })).toBe(expected)
  })

  it('does not mislabel accepted or revoked records as expired on detail views', () => {
    expect(getInviteStatus({ expiresAt: baseInvite.expires_at, acceptedAt: now.toISOString() })).toBe('accepted')
    expect(getInviteStatus({ expiresAt: baseInvite.expires_at, revokedAt: now.toISOString() })).toBe('revoked')
  })
})
