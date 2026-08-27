/**
 * Integration tests for grounded-chat tools.
 *
 * The point of these tests is the isolation guarantee: the SAME tool code,
 * given a platform admin's connection versus a client member's connection,
 * must return everything and only-their-own respectively — with no tenant
 * predicate anywhere in the tool body. If that stops being true, grounded
 * chat leaks across tenants, so these assertions are the real gate on the
 * feature rather than a smoke test.
 *
 * Host-guarded via _helpers/rls-fixture (local Supabase only).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { canRun, createAdminClient, createTestUser } from './_helpers/rls-fixture'
import { findParticipantTool } from '@/lib/chat/tools/find-participant'
import { findCampaignTool } from '@/lib/chat/tools/find-campaign'
import { findAssessmentTool } from '@/lib/chat/tools/find-assessment'

const ts = Date.now()
const tag = `chat${ts}`

function email(label: string) {
  return `chat-${label}-${ts}@test.local`
}

describe.skipIf(!canRun)('grounded chat tools', () => {
  const admin = createAdminClient()

  const ids = {
    clientA: '',
    clientB: '',
    campaignA: '',
    campaignB: '',
    assessmentA: '',
    assessmentB: '',
    participantA: '',
    participantB: '',
  }

  let adminDb: SupabaseClient
  let clientADb: SupabaseClient

  beforeAll(async () => {
    const mk = async (name: string) => {
      const { data, error } = await admin
        .from('clients')
        .insert({ name, slug: `${name}`.toLowerCase() })
        .select('id')
        .single()
      if (error) throw new Error(`client insert failed: ${error.message}`)
      return data.id as string
    }
    ids.clientA = await mk(`${tag}-alpha`)
    ids.clientB = await mk(`${tag}-beta`)

    const mkAssessment = async (clientId: string, title: string) => {
      const { data, error } = await admin
        .from('assessments')
        .insert({ client_id: clientId, title, slug: title.toLowerCase(), status: 'active' })
        .select('id')
        .single()
      if (error) throw new Error(`assessment insert failed: ${error.message}`)
      return data.id as string
    }
    ids.assessmentA = await mkAssessment(ids.clientA, `${tag}-alpha-instrument`)
    ids.assessmentB = await mkAssessment(ids.clientB, `${tag}-beta-instrument`)

    const mkCampaign = async (clientId: string, title: string) => {
      const { data, error } = await admin
        .from('campaigns')
        .insert({ client_id: clientId, title, slug: title.toLowerCase(), status: 'active' })
        .select('id')
        .single()
      if (error) throw new Error(`campaign insert failed: ${error.message}`)
      return data.id as string
    }
    ids.campaignA = await mkCampaign(ids.clientA, `${tag}-alpha-campaign`)
    ids.campaignB = await mkCampaign(ids.clientB, `${tag}-beta-campaign`)

    const mkParticipant = async (campaignId: string, first: string) => {
      const { data, error } = await admin
        .from('campaign_participants')
        .insert({
          campaign_id: campaignId,
          email: `${first}-${ts}@test.local`.toLowerCase(),
          first_name: first,
          last_name: tag,
          status: 'invited',
        })
        .select('id')
        .single()
      if (error) throw new Error(`participant insert failed: ${error.message}`)
      return data.id as string
    }
    ids.participantA = await mkParticipant(ids.campaignA, 'Alfa')
    ids.participantB = await mkParticipant(ids.campaignB, 'Bravo')

    const adminUser = await createTestUser(admin, {
      email: email('admin'),
      role: 'platform_admin',
    })
    adminDb = adminUser.client

    const clientUser = await createTestUser(admin, {
      email: email('clienta'),
      role: 'org_admin',
      clientId: ids.clientA,
    })
    clientADb = clientUser.client
    await admin.from('client_memberships').insert({
      profile_id: clientUser.userId,
      client_id: ids.clientA,
      role: 'admin',
    })
  }, 60_000)

  afterAll(async () => {
    if (!canRun) return
    await admin.from('campaign_participants').delete().in('campaign_id', [ids.campaignA, ids.campaignB])
    await admin.from('campaigns').delete().in('id', [ids.campaignA, ids.campaignB])
    await admin.from('assessments').delete().in('id', [ids.assessmentA, ids.assessmentB])
    await admin.from('client_memberships').delete().in('client_id', [ids.clientA, ids.clientB])
    await admin.from('clients').delete().in('id', [ids.clientA, ids.clientB])
  })

  const ctx = (db: SupabaseClient, isPlatformAdmin: boolean) => ({ db, isPlatformAdmin })

  describe('find_participant', () => {
    it('a platform admin sees participants across every tenant', async () => {
      const result = await findParticipantTool.execute({ query: tag }, ctx(adminDb, true))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const ids_ = result.data.participants.map((p) => p.participantId)
      expect(ids_).toContain(ids.participantA)
      expect(ids_).toContain(ids.participantB)
    })

    it('a client member sees only their own tenant, through identical code', async () => {
      const result = await findParticipantTool.execute({ query: tag }, ctx(clientADb, false))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const ids_ = result.data.participants.map((p) => p.participantId)
      expect(ids_).toContain(ids.participantA)
      expect(ids_).not.toContain(ids.participantB)
    })

    it("returns not_found — never a guess — for another tenant's person", async () => {
      const result = await findParticipantTool.execute({ query: 'Bravo' }, ctx(clientADb, false))
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.reason).toBe('not_found')
    })

    it('treats LIKE wildcards in the query as literal text', async () => {
      const result = await findParticipantTool.execute({ query: '%' }, ctx(adminDb, true))
      // A bare '%' must not match every participant in the database.
      if (result.ok) {
        expect(result.data.participants.map((p) => p.participantId)).not.toContain(
          ids.participantA,
        )
      } else {
        expect(result.reason).toBe('not_found')
      }
    })
  })

  describe('find_campaign', () => {
    it('scopes campaigns to the caller tenant', async () => {
      const asAdmin = await findCampaignTool.execute({ query: tag }, ctx(adminDb, true))
      const asClient = await findCampaignTool.execute({ query: tag }, ctx(clientADb, false))
      expect(asAdmin.ok).toBe(true)
      expect(asClient.ok).toBe(true)
      if (!asAdmin.ok || !asClient.ok) return
      expect(asAdmin.data.campaigns.map((c) => c.campaignId)).toEqual(
        expect.arrayContaining([ids.campaignA, ids.campaignB]),
      )
      const clientIds = asClient.data.campaigns.map((c) => c.campaignId)
      expect(clientIds).toContain(ids.campaignA)
      expect(clientIds).not.toContain(ids.campaignB)
    })
  })

  describe('find_assessment', () => {
    it('scopes assessments to the caller tenant', async () => {
      const asClient = await findAssessmentTool.execute({ query: tag }, ctx(clientADb, false))
      expect(asClient.ok).toBe(true)
      if (!asClient.ok) return
      const found = asClient.data.assessments.map((a) => a.assessmentId)
      expect(found).not.toContain(ids.assessmentB)
    })
  })
})
