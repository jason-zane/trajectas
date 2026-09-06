import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { canRun, createAdminClient } from './_helpers/rls-fixture'

describe.skipIf(!canRun)('enrolled campaign confidentiality', () => {
  const db = createAdminClient(), client = randomUUID()
  const campaigns: string[] = []
  beforeAll(async () => {
    const { error } = await db.from('clients').insert({ id: client, name: 'Privacy lock', slug: client })
    if (error) throw error
  })
  afterAll(async () => {
    await db.from('campaigns').delete().in('id', campaigns)
    await db.from('clients').delete().eq('id', client)
  })
  async function campaign(mode = 'standard') {
    const id = randomUUID()
    campaigns.push(id)
    const { error } = await db.from('campaigns').insert({ id, title: 'Privacy lock', slug: id,
      client_id: client, confidentiality_mode: mode })
    if (error) throw error
    return id
  }
  async function enroll(campaignId: string, extra = {}) {
    return db.from('campaign_participants').insert({ campaign_id: campaignId,
      email: `${randomUUID()}@test.local`, first_name: 'Privacy', ...extra })
  }
  it('permits confidentiality changes before enrollment', async () => {
    const id = await campaign()
    for (const mode of ['aggregate_only', 'standard']) {
      const { error } = await db.from('campaigns').update({ confidentiality_mode: mode }).eq('id', id)
      expect(error).toBeNull()
    }
  })
  it.each(['standard', 'aggregate_only'])('locks %s after enrollment while allowing unrelated edits', async mode => {
    const id = await campaign(mode)
    expect((await enroll(id)).error).toBeNull()
    const otherMode = mode === 'standard' ? 'aggregate_only' : 'standard'
    const changed = await db.from('campaigns').update({ confidentiality_mode: otherMode }).eq('id', id)
    expect(changed.error?.code).toBe('23514')
    const unchanged = await db.from('campaigns').update({ title: 'Renamed', confidentiality_mode: mode }).eq('id', id)
    expect(unchanged.error).toBeNull()
  })
  it('counts withdrawn and soft-deleted participants when preserving prior consent', async () => {
    const id = await campaign()
    expect((await enroll(id, { status: 'withdrawn', deleted_at: new Date().toISOString() })).error).toBeNull()
    const changed = await db.from('campaigns').update({ confidentiality_mode: 'aggregate_only' }).eq('id', id)
    expect(changed.error?.code).toBe('23514')
  })
  it('serializes an empty campaign mode change against concurrent enrollment', async () => {
    const id = await campaign()
    const [inserted, updated] = await Promise.all([
      enroll(id), db.from('campaigns').update({ confidentiality_mode: 'aggregate_only' }).eq('id', id),
    ])
    expect(inserted.error).toBeNull()
    expect(updated.error === null || updated.error.code === '23514').toBe(true)
    const { data } = await db.from('campaigns').select('confidentiality_mode').eq('id', id).single()
    expect(data?.confidentiality_mode).toBe(updated.error ? 'standard' : 'aggregate_only')
    const changed = await db.from('campaigns').update({ confidentiality_mode: updated.error ? 'aggregate_only' : 'standard' }).eq('id', id)
    expect(changed.error?.code).toBe('23514')
  })
})
