import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { canRun, createAdminClient } from './_helpers/rls-fixture'
import { createStaffInvite, finalizeInviteAcceptance, type InviteRole } from '@/lib/auth/staff-auth'

describe.skipIf(!canRun)('staff invite profile boundaries', () => {
  const db = createAdminClient()
  const partner = randomUUID(), client = randomUUID(), otherClient = randomUUID()
  const users: string[] = []
  let issuer: string
  async function user(role?: string, isActive = true) {
    const email = `${randomUUID()}@test.local`
    const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true })
    if (error || !data.user) throw error ?? new Error('Missing fixture user')
    users.push(data.user.id)
    if (role) {
      const result = await db.from('profiles').insert({ id: data.user.id, email, role,
        first_name: 'Invite', last_name: 'Test', is_active: isActive })
      if (result.error) throw result.error
    }
    return data.user
  }
  async function invite(email: string, role: InviteRole) {
    const tenantType = role.startsWith('client') ? 'client' : role.startsWith('partner') ? 'partner' : 'platform'
    const result = await createStaffInvite({ email, role, tenantType,
      ...(tenantType === 'platform' ? {} : { tenantId: tenantType === 'client' ? client : partner }),
      invitedByProfileId: issuer })
    if ('error' in result) throw new Error(JSON.stringify(result.error))
    return result
  }
  beforeAll(async () => {
    const owner = await user('platform_admin')
    issuer = owner.id
    const p = await db.from('partners').insert({ id: partner, name: 'Invite test', slug: partner })
    if (p.error) throw p.error
    const c = await db.from('clients').insert([
      { id: client, name: 'Invite target', slug: client, partner_id: partner },
      { id: otherClient, name: 'Existing membership', slug: otherClient },
    ])
    if (c.error) throw c.error
  })
  afterAll(async () => {
    await db.from('user_invites').delete().eq('invited_by_profile_id', issuer)
    for (const id of users.reverse()) await db.auth.admin.deleteUser(id)
    await db.from('clients').delete().in('id', [client, otherClient])
    await db.from('partners').delete().eq('id', partner)
  })
  it.each(['client_admin', 'partner_admin', 'platform_admin'] as const)(
    'does not reactivate a suspended account via a %s invite or restore its other memberships', async role => {
      const target = await user('org_admin', false)
      const membership = await db.from('client_memberships').insert({ profile_id: target.id, client_id: otherClient, role: 'admin' })
      expect(membership.error).toBeNull()
      const pending = await invite(target.email!, role)
      await expect(finalizeInviteAcceptance(target, pending.inviteToken)).rejects.toThrow('inactive')
      const { data: profile } = await db.from('profiles').select('role,is_active').eq('id', target.id).single()
      expect(profile).toEqual({ role: 'org_admin', is_active: false })
      const { data: memberships } = await db.from('client_memberships').select('client_id,revoked_at').eq('profile_id', target.id)
      expect(memberships).toEqual([{ client_id: otherClient, revoked_at: null }])
      const { data: accepted } = await db.from('user_invites').select('accepted_at').eq('id', pending.data.id).single()
      expect(accepted?.accepted_at).toBeNull()
    },
  )
  it.each(['client_admin', 'client_member', 'partner_admin', 'partner_member'] as const)(
    'keeps an existing platform administrator role after a %s invitation', async role => {
      const target = await user('platform_admin')
      const pending = await invite(target.email!, role)
      await finalizeInviteAcceptance(target, pending.inviteToken)
      const { data: profile } = await db.from('profiles').select('role,is_active').eq('id', target.id).single()
      expect(profile).toEqual({ role: 'platform_admin', is_active: true })
      const table = role.startsWith('client') ? 'client_memberships' : 'partner_memberships'
      const { data: memberships } = await db.from(table).select('role').eq('profile_id', target.id)
      expect(memberships).toEqual([{ role: role.endsWith('admin') ? 'admin' : 'member' }])
    },
  )
  it('preserves an existing non-platform global role when adding another tenant', async () => {
    const target = await user('org_admin')
    const pending = await invite(target.email!, 'partner_member')
    await finalizeInviteAcceptance(target, pending.inviteToken)
    const { data } = await db.from('profiles').select('role').eq('id', target.id).single()
    expect(data?.role).toBe('org_admin')
  })
  it.each([['client_admin', 'org_admin'], ['partner_admin', 'partner_admin'], ['client_member', 'consultant']] as const)(
    'gives a new profile the intended role for %s', async (role, expectedRole) => {
      const target = await user()
      const pending = await invite(target.email!, role)
      await finalizeInviteAcceptance(target, pending.inviteToken)
      const { data } = await db.from('profiles').select('role,is_active').eq('id', target.id).single()
      expect(data).toEqual({ role: expectedRole, is_active: true })
    },
  )
  it('permits an explicit platform invitation to promote an active existing account', async () => {
    const target = await user('consultant')
    const pending = await invite(target.email!, 'platform_admin')
    await finalizeInviteAcceptance(target, pending.inviteToken)
    const { data } = await db.from('profiles').select('role,is_active').eq('id', target.id).single()
    expect(data).toEqual({ role: 'platform_admin', is_active: true })
  })
})
