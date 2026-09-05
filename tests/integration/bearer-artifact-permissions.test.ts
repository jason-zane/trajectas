import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { canRun, createAdminClient, createTestUser } from './_helpers/rls-fixture'

// PHASE 2 ONLY: restore to tests/integration after phase-one application
// deployment, then apply both phase-two permission migrations locally first.
// The shared canRun guard and fixture refuse non-local Supabase URLs.
describe.skipIf(!canRun)('phase-two bearer artifact permissions', () => {
  const admin = createAdminClient()
  const partnerId = randomUUID(), clientId = randomUUID(), otherClientId = randomUUID()
  const campaignId = randomUUID(), otherCampaignId = randomUUID()
  const assessmentId = randomUUID()
  const participantId = randomUUID(), otherParticipantId = randomUUID(), privateToken = randomUUID()
  const actors: Record<string, { userId: string; client: SupabaseClient }> = {}
  const bearerTables = ['integration_launches', 'integration_idempotency_keys',
    'integration_events_outbox', 'integration_webhook_deliveries'] as const

  async function insert(table: string, values: Record<string, unknown> | Record<string, unknown>[]) {
    const { error } = await admin.from(table).insert(values)
    if (error) throw new Error(`${table}: ${error.message}`)
  }
  beforeAll(async () => {
    await insert('partners', { id: partnerId, name: 'Permission test', slug: partnerId })
    await insert('clients', [
      { id: clientId, name: 'Own client', slug: clientId, partner_id: partnerId },
      { id: otherClientId, name: 'Other client', slug: otherClientId },
    ])
    await insert('campaigns', [
      { id: campaignId, title: 'Own campaign', slug: campaignId, client_id: clientId, partner_id: partnerId },
      { id: otherCampaignId, title: 'Other campaign', slug: otherCampaignId, client_id: otherClientId },
    ])
    await insert('assessments', { id: assessmentId, title: 'Count compatibility', slug: assessmentId })
    await insert('campaign_assessments', [
      { campaign_id: campaignId, assessment_id: assessmentId },
      { campaign_id: otherCampaignId, assessment_id: assessmentId },
    ])
    await insert('campaign_participants', [
      { id: participantId, campaign_id: campaignId, email: `${participantId}@test.local`, access_token: privateToken },
      { id: otherParticipantId, campaign_id: otherCampaignId, email: `${otherParticipantId}@test.local`, access_token: randomUUID() },
    ])
    for (const [label, role] of [['clientAdmin', 'org_admin'], ['clientMember', 'consultant']] as const) {
      actors[label] = await createTestUser(admin, {
        email: `${label}-${randomUUID()}@test.local`, role, clientId, partnerId,
      })
      await insert('client_memberships', { profile_id: actors[label].userId, client_id: clientId,
        role: label === 'clientAdmin' ? 'admin' : 'member' })
    }
    actors.partnerAdmin = await createTestUser(admin, {
      email: `partner-${randomUUID()}@test.local`, role: 'partner_admin', partnerId,
    })
    await insert('partner_memberships', { profile_id: actors.partnerAdmin.userId, partner_id: partnerId, role: 'admin' })
    actors.platformAdmin = await createTestUser(admin, {
      email: `platform-${randomUUID()}@test.local`, role: 'platform_admin',
    })
  })
  afterAll(async () => {
    for (const actor of Object.values(actors)) await admin.auth.admin.deleteUser(actor.userId)
    await admin.from('campaigns').delete().in('id', [campaignId, otherCampaignId])
    await admin.from('assessments').delete().eq('id', assessmentId)
    await admin.from('clients').delete().in('id', [clientId, otherClientId])
    await admin.from('partners').delete().eq('id', partnerId)
  })

  it.each(['clientAdmin', 'clientMember', 'partnerAdmin', 'platformAdmin'])(
    '%s cannot read a raw participant token, including its own client', async actor => {
      const result = await actors[actor].client.from('campaign_participants')
        .select('id,access_token').eq('id', participantId)
      expect(result.error?.code).toBe('42501')
      expect(result.data).toBeNull()
    },
  )
  it.each(['clientAdmin', 'clientMember', 'partnerAdmin'])(
    '%s retains the safe own-client roster without gaining another client', async actor => {
      const result = await actors[actor].client.from('campaign_participants')
        .select('id,campaign_id,email,status').in('id', [participantId, otherParticipantId])
      expect(result.error).toBeNull()
      expect(result.data?.map(row => row.id)).toEqual([participantId])
      expect(result.data?.[0]).not.toHaveProperty('access_token')
    },
  )
  it('keeps authenticated platform-admin safe roster access', async () => {
    const result = await actors.platformAdmin.client.from('campaign_participants')
      .select('id,email,status').in('id', [participantId, otherParticipantId])
    expect(result.error).toBeNull()
    expect(result.data?.map(row => row.id).sort()).toEqual([participantId, otherParticipantId].sort())
  })
  it.each(['clientAdmin', 'clientMember', 'partnerAdmin', 'platformAdmin'])(
    '%s retains scoped nested campaign-view counts after token grants are removed', async actor => {
      const result = await actors[actor].client.from('campaign_assessments')
        .select('campaign_id,assessment_id,campaigns:campaigns_with_counts(id,title,status,client_id,clients(name),participant_count),assessments(id,title)')
        .in('campaign_id', [campaignId, otherCampaignId])
      const expectedIds = actor === 'platformAdmin' ? [campaignId, otherCampaignId] : [campaignId]
      expect(result.error).toBeNull()
      expect(result.data?.map(row => row.campaign_id).sort()).toEqual(expectedIds.sort())
      for (const row of result.data ?? []) {
        const campaign = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns
        expect(campaign).toMatchObject({ id: row.campaign_id, participant_count: 1 })
      }
    },
  )
  it.each(['clientAdmin', 'clientMember', 'partnerAdmin', 'platformAdmin'])(
    '%s retains scoped campaigns_with_counts reads after token grants are removed', async actor => {
      // Match the campaign-list DAL's view projection, including the client embed.
      const result = await actors[actor].client.from('campaigns_with_counts')
        .select('*,clients(name)').in('id', [campaignId, otherCampaignId])
      const expectedIds = actor === 'platformAdmin' ? [campaignId, otherCampaignId] : [campaignId]
      expect(result.error).toBeNull()
      expect(result.data?.map(row => row.id).sort()).toEqual(expectedIds.sort())
      for (const row of result.data ?? []) {
        expect(row.participant_count).toBe(1)
        expect(row.completed_count).toBe(0)
        expect(row.assessment_count).toBe(1)
        expect(row).not.toHaveProperty('access_token')
      }
    },
  )
  it('fails closed for legacy SELECT * rather than silently including a token', async () => {
    const result = await actors.clientAdmin.client.from('campaign_participants').select('*').eq('id', participantId)
    expect(result.error?.code).toBe('42501')
    expect(result.data).toBeNull()
  })
  it('retains the server service-role token needed for private invitation delivery', async () => {
    const result = await admin.from('campaign_participants').select('id,access_token').eq('id', participantId).single()
    expect(result.error).toBeNull()
    expect(result.data?.access_token).toBe(privateToken)
  })
  it.each(bearerTables)('denies every authenticated staff role direct reads of %s', async table => {
    for (const actor of Object.values(actors)) {
      const result = await actor.client.from(table).select('id').limit(1)
      expect(result.error?.code).toBe('42501')
      expect(result.data).toBeNull()
    }
  })
  it.each(bearerTables)('retains the service-role integration worker read of %s', async table => {
    const result = await admin.from(table).select('id').limit(1)
    expect(result.error).toBeNull()
    expect(Array.isArray(result.data)).toBe(true)
  })
})
