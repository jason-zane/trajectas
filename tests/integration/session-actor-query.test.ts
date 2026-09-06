import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { canRun, createAdminClient, createTestUser } from './_helpers/rls-fixture'

const request = vi.hoisted(() => ({ userId: null as string | null }))
vi.mock('@/lib/auth/claims', () => ({ getVerifiedUserId: async () => request.userId }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({}) }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))

// Exercise actual PostgREST embedding and FK selection against the guarded local DB.
describe.skipIf(!canRun)('staff actor query', () => {
  const db = createAdminClient()
  const ids = Object.fromEntries(['partnerA', 'partnerB', 'clientA', 'clientB', 'pa', 'pb', 'otherP', 'ca', 'cb', 'otherC'].map(key => [key, randomUUID()]))
  const users: string[] = []
  async function insert(table: string, rows: Record<string, unknown>[]) {
    const result = await db.from(table).insert(rows)
    if (result.error) throw new Error(`${table}: ${result.error.message}`)
  }
  beforeAll(async () => {
    await insert('partners', [ids.partnerA, ids.partnerB].map(id => ({ id, name: 'Actor query partner', slug: id })))
    await insert('clients', [ids.clientA, ids.clientB].map(id => ({ id, name: 'Actor query client', slug: id })))
    for (let i = 0; i < 2; i++) {
      const user = await createTestUser(db, { email: `actor-${randomUUID()}@test.local`, role: 'platform_admin' })
      users.push(user.userId)
    }
    const revoked_at = new Date().toISOString()
    await insert('partner_memberships', [
      { id: ids.pa, profile_id: users[0], partner_id: ids.partnerA, role: 'admin' },
      { id: ids.pb, profile_id: users[0], partner_id: ids.partnerB, role: 'member', revoked_at },
      { id: ids.otherP, profile_id: users[1], partner_id: ids.partnerB, role: 'admin', created_by: users[0] },
    ])
    await insert('client_memberships', [
      { id: ids.ca, profile_id: users[0], client_id: ids.clientA, role: 'admin' },
      { id: ids.cb, profile_id: users[0], client_id: ids.clientB, role: 'member', revoked_at },
      { id: ids.otherC, profile_id: users[1], client_id: ids.clientB, role: 'admin', created_by: users[0] },
    ])
  }, 30_000)
  afterAll(async () => {
    for (const table of ['partner_memberships', 'client_memberships']) {
      if (users.length) await db.from(table).delete().in('profile_id', users)
    }
    for (const user of users) {
      await db.from('profiles').delete().eq('id', user)
      await db.auth.admin.deleteUser(user)
    }
    await db.from('clients').delete().in('id', [ids.clientA, ids.clientB])
    await db.from('partners').delete().in('id', [ids.partnerA, ids.partnerB])
  }, 30_000)

  it('uses one request and returns only the actor’s active memberships, not memberships they created', async () => {
    request.userId = users[0]
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { resolveSessionActor } = await import('@/lib/auth/actor')
    const actor = await resolveSessionActor()
    expect(actor?.id).toBe(users[0])
    expect(actor?.partnerMemberships.map(row => row.id)).toEqual([ids.pa])
    expect(actor?.clientMemberships.map(row => row.id)).toEqual([ids.ca])
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('sees revocation immediately and retains a platform actor with no memberships', async () => {
    expect((await db.from('partner_memberships').update({ revoked_at: new Date().toISOString() }).eq('id', ids.pa)).error).toBeNull()
    expect((await db.from('client_memberships').update({ revoked_at: new Date().toISOString() }).eq('id', ids.ca)).error).toBeNull()
    request.userId = users[0]
    const { resolveSessionActor } = await import('@/lib/auth/actor')
    const actor = await resolveSessionActor()
    expect(actor).toMatchObject({ id: users[0], role: 'platform_admin', isActive: true, partnerMemberships: [], clientMemberships: [] })
  })

  it('reads account deactivation freshly', async () => {
    expect((await db.from('profiles').update({ is_active: false }).eq('id', users[0])).error).toBeNull()
    request.userId = users[0]
    const { resolveSessionActor } = await import('@/lib/auth/actor')
    expect((await resolveSessionActor())?.isActive).toBe(false)
  })

  it('returns no actor for an absent profile or unverified session', async () => {
    const { resolveSessionActor } = await import('@/lib/auth/actor')
    request.userId = randomUUID()
    expect(await resolveSessionActor()).toBeNull()
    request.userId = null
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    expect(await resolveSessionActor()).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
