import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { canRun, createAdminClient, createTestUser } from './_helpers/rls-fixture'
import type { ResolvedActor } from '@/lib/auth/types'

const request = vi.hoisted(() => ({ actor: null as ResolvedActor | null }))
vi.mock('@/lib/auth/actor', () => ({
  resolveSessionActor: async () => request.actor,
  resolveSignedPreviewContext: async () => null,
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: 'localhost:3000', 'x-trajectas-surface': 'partner' }) }))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))

/** Real local RLS clients plus the real service-role campaign management action. */
describe.skipIf(!canRun)('campaign ownership follows client transfers', () => {
  const db = createAdminClient()
  const ids = Object.fromEntries(['a', 'b', 'client', 'clientB', 'campaign', 'deleted', 'participant', 'standalone']
    .map(key => [key, randomUUID()]))
  const users: Array<{ userId: string; client: SupabaseClient; actor: ResolvedActor }> = []
  const createdCampaigns = [ids.campaign, ids.deleted, ids.standalone]
  async function insert(table: string, data: Record<string, unknown> | Record<string, unknown>[]) {
    const result = await db.from(table).insert(data)
    if (result.error) throw new Error(`${table}: ${result.error.message}`)
  }
  async function owner() {
    const result = await db.from('campaigns').select('partner_id').eq('id', ids.campaign).single()
    expect(result.error).toBeNull()
    return result.data!.partner_id
  }
  async function visibility(index: number, allowed: boolean) {
    for (const [table, id] of [['campaigns', ids.campaign], ['campaign_participants', ids.participant]]) {
      const result = await users[index].client.from(table).select('id').eq('id', id)
      expect(result.error).toBeNull()
      expect(result.data).toEqual(allowed ? [{ id }] : [])
    }
    request.actor = users[index].actor
    const { getAccessibleCampaignIds, resolveAuthorizedScope } = await import('@/lib/auth/authorization')
    const visible = await getAccessibleCampaignIds(await resolveAuthorizedScope())
    expect(visible?.includes(ids.campaign)).toBe(allowed)
    const { updateCampaignField } = await import('@/app/actions/campaigns')
    const result = await updateCampaignField(ids.campaign, 'description', `Updated by ${index}`)
    expect('error' in result).toBe(!allowed)
  }
  beforeAll(async () => {
    await insert('partners', [{ id: ids.a, name: 'Transfer A', slug: ids.a }, { id: ids.b, name: 'Transfer B', slug: ids.b }])
    await insert('clients', [{ id: ids.client, name: 'Transfer client', slug: ids.client, partner_id: ids.a },
      { id: ids.clientB, name: 'Other B client', slug: ids.clientB, partner_id: ids.b }])
    await insert('campaigns', [
      { id: ids.campaign, title: 'Transfer campaign', slug: ids.campaign, client_id: ids.client, partner_id: ids.a },
      { id: ids.deleted, title: 'Deleted campaign', slug: ids.deleted, client_id: ids.client, partner_id: ids.a, deleted_at: new Date().toISOString() },
      { id: ids.standalone, title: 'Standalone', slug: ids.standalone, partner_id: ids.a },
    ])
    await insert('campaign_participants', { id: ids.participant, campaign_id: ids.campaign, email: `${ids.participant}@test.local` })
    for (const [index, partnerId] of [ids.a, ids.b, null].entries()) {
      const created = await createTestUser(db, { email: `transfer-${randomUUID()}@test.local`,
        role: partnerId ? 'partner_admin' : 'org_admin', partnerId: partnerId ?? undefined, clientId: partnerId ? undefined : ids.client })
      const membership = randomUUID()
      if (partnerId) await insert('partner_memberships', { id: membership, profile_id: created.userId, partner_id: partnerId, role: 'admin' })
      else await insert('client_memberships', { id: membership, profile_id: created.userId, client_id: ids.client, role: 'admin' })
      users.push({ ...created, actor: {
        id: created.userId, email: `actor-${index}@test.local`, role: partnerId ? 'partner_admin' : 'org_admin', isActive: true,
        partnerMemberships: partnerId ? [{ id: membership, partnerId, role: 'admin', isDefault: true, createdAt: new Date().toISOString() }] : [],
        clientMemberships: partnerId ? [] : [{ id: membership, clientId: ids.client, role: 'admin', isDefault: true, createdAt: new Date().toISOString() }],
        activeContext: null,
      } })
    }
  }, 30_000)
  afterAll(async () => {
    await db.from('campaigns').delete().in('id', createdCampaigns)
    await db.from('clients').delete().in('id', [ids.client, ids.clientB])
    for (const user of users) {
      await db.from('partner_memberships').delete().eq('profile_id', user.userId)
      await db.from('client_memberships').delete().eq('profile_id', user.userId)
      await db.from('profiles').delete().eq('id', user.userId)
      await db.auth.admin.deleteUser(user.userId)
    }
    await db.from('partners').delete().in('id', [ids.a, ids.b])
  }, 30_000)

  it('moves all campaigns A→B and revokes former partner reads and management immediately', async () => {
    await visibility(0, true)
    await visibility(1, false)
    expect((await db.from('clients').update({ partner_id: ids.b }).eq('id', ids.client)).error).toBeNull()
    expect(await owner()).toBe(ids.b)
    expect((await db.from('campaigns').select('partner_id').eq('id', ids.deleted).single()).data?.partner_id).toBe(ids.b)
    await visibility(0, false)
    await visibility(1, true)
    await visibility(2, true) // Explicit client membership survives a partner transfer.
  })

  it('moves B→platform ownership without retaining partner access', async () => {
    expect((await db.from('clients').update({ partner_id: null }).eq('id', ids.client)).error).toBeNull()
    expect(await owner()).toBeNull()
    await visibility(0, false)
    await visibility(1, false)
    await visibility(2, true)
  })

  it('rejects stale partner writes and moving a campaign to a mismatched client', async () => {
    for (const patch of [{ partner_id: ids.a }, { partner_id: ids.b }, { client_id: ids.clientB }]) {
      const result = await db.from('campaigns').update(patch).eq('id', ids.campaign)
      expect(result.error?.code).toBe('23514')
    }
    const stale = randomUUID()
    createdCampaigns.push(stale)
    expect((await db.from('campaigns').insert({ id: stale, title: 'Stale', slug: stale,
      client_id: ids.client, partner_id: ids.a })).error?.code).toBe('23514')
    expect(await owner()).toBeNull()
    const moved = await db.from('campaigns').update({ client_id: ids.clientB, partner_id: ids.b }).eq('id', ids.campaign)
    expect(moved.error).toBeNull()
    expect(await owner()).toBe(ids.b)
    expect((await db.from('campaigns').update({ client_id: ids.client, partner_id: null }).eq('id', ids.campaign)).error).toBeNull()
  })

  it('preserves independent partner and platform ownership for standalone campaigns', async () => {
    for (const partner_id of [ids.b, null, ids.a]) {
      const result = await db.from('campaigns').update({ partner_id }).eq('id', ids.standalone)
        .select('client_id,partner_id').single()
      expect(result.error).toBeNull()
      expect(result.data).toEqual({ client_id: null, partner_id })
    }
  })

  it('supports parent client deletion and partner deletion through existing nullable FKs', async () => {
    const partner = randomUUID(), client = randomUUID(), campaign = randomUUID()
    createdCampaigns.push(campaign)
    await insert('partners', { id: partner, name: 'Delete partner', slug: partner })
    await insert('clients', { id: client, name: 'Delete client', slug: client, partner_id: partner })
    await insert('campaigns', { id: campaign, title: 'Delete parents', slug: campaign, client_id: client, partner_id: partner })
    try {
      expect((await db.from('partners').delete().eq('id', partner)).error).toBeNull()
      expect((await db.from('campaigns').select('partner_id').eq('id', campaign).single()).data?.partner_id).toBeNull()
      expect((await db.from('clients').delete().eq('id', client)).error).toBeNull()
      expect((await db.from('campaigns').select('client_id,partner_id').eq('id', campaign).single()).data)
        .toEqual({ client_id: null, partner_id: null })
    } finally {
      await db.from('campaigns').delete().eq('id', campaign)
      await db.from('clients').delete().eq('id', client)
      await db.from('partners').delete().eq('id', partner)
    }
  })
})
