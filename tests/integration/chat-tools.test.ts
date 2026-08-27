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
import { getSessionScoresTool } from '@/lib/chat/tools/get-session-scores'

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
    factor: '',
    sessionA: '',
    campaignConfidential: '',
    participantConfidential: '',
    sessionConfidential: '',
  }

  let adminDb: SupabaseClient
  let clientADb: SupabaseClient
  let clientBDb: SupabaseClient

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

    // --- a scored sitting for client A -----------------------------------
    const { data: factor, error: fErr } = await admin
      .from('factors')
      .insert({ name: `${tag}-judgement`, slug: `${tag}-judgement` })
      .select('id')
      .single()
    if (fErr) throw new Error(`factor insert failed: ${fErr.message}`)
    ids.factor = factor.id as string

    const mkSession = async (
      campaignId: string,
      participantId: string,
      clientId: string,
      assessmentId: string,
    ) => {
      const { data, error } = await admin
        .from('participant_sessions')
        .insert({
          assessment_id: assessmentId,
          campaign_id: campaignId,
          campaign_participant_id: participantId,
          client_id: clientId,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      if (error) throw new Error(`session insert failed: ${error.message}`)
      return data.id as string
    }

    const mkScore = async (sessionId: string, scaled: number) => {
      // No percentile: participant_scores_norm_referenced_requires_group
      // forbids one without a versioned norm group, which is exactly the
      // uncalibrated state the claims ladder is built around.
      const { error } = await admin.from('participant_scores').insert({
        session_id: sessionId,
        factor_id: ids.factor,
        raw_score: 31,
        scaled_score: scaled,
        scoring_method: 'ctt',
        metric: 'pomp',
        provisional: false,
      })
      if (error) throw new Error(`score insert failed: ${error.message}`)
    }

    ids.sessionA = await mkSession(
      ids.campaignA,
      ids.participantA,
      ids.clientA,
      ids.assessmentA,
    )
    await mkScore(ids.sessionA, 62.4)

    // --- an aggregate-only campaign for client A --------------------------
    const { data: confCampaign, error: ccErr } = await admin
      .from('campaigns')
      .insert({
        client_id: ids.clientA,
        title: `${tag}-confidential`,
        slug: `${tag}-confidential`,
        status: 'active',
        confidentiality_mode: 'aggregate_only',
      })
      .select('id')
      .single()
    if (ccErr) throw new Error(`confidential campaign insert failed: ${ccErr.message}`)
    ids.campaignConfidential = confCampaign.id as string
    ids.participantConfidential = await mkParticipant(ids.campaignConfidential, 'Charlie')
    ids.sessionConfidential = await mkSession(
      ids.campaignConfidential,
      ids.participantConfidential,
      ids.clientA,
      ids.assessmentA,
    )
    await mkScore(ids.sessionConfidential, 77.7)

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

    const clientBUser = await createTestUser(admin, {
      email: email('clientb'),
      role: 'org_admin',
      clientId: ids.clientB,
    })
    clientBDb = clientBUser.client
    await admin.from('client_memberships').insert({
      profile_id: clientBUser.userId,
      client_id: ids.clientB,
      role: 'admin',
    })
  }, 60_000)

  afterAll(async () => {
    if (!canRun) return
    await admin
      .from('participant_scores')
      .delete()
      .in('session_id', [ids.sessionA, ids.sessionConfidential])
    await admin
      .from('participant_sessions')
      .delete()
      .in('id', [ids.sessionA, ids.sessionConfidential])
    await admin.from('factors').delete().eq('id', ids.factor)
    await admin
      .from('campaign_participants')
      .delete()
      .in('campaign_id', [ids.campaignA, ids.campaignB, ids.campaignConfidential])
    await admin
      .from('campaigns')
      .delete()
      .in('id', [ids.campaignA, ids.campaignB, ids.campaignConfidential])
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
  describe('get_session_scores', () => {
    it('returns resolved competency scores for a visible sitting', async () => {
      const result = await getSessionScoresTool.execute(
        { session_id: ids.sessionA },
        ctx(adminDb, true),
      )
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.factors).toHaveLength(1)
      expect(result.data.factors[0].scaledScore).toBeCloseTo(62.4, 1)
      expect(result.data.normReferenced).toBe(false)
    })

    it('omits the percentile entirely when there is no norm group', () => {
      // Not null — absent. The uncalibrated branch of the claims ladder has no
      // such field, so a rank claim cannot be forwarded from this data.
      return getSessionScoresTool
        .execute({ session_id: ids.sessionA }, ctx(adminDb, true))
        .then((result) => {
          expect(result.ok).toBe(true)
          if (!result.ok) return
          expect('percentile' in result.data.factors[0]).toBe(false)
          expect(result.data.caveats.join(' ')).toMatch(/no norm group/i)
        })
    })

    it("a client member cannot read another tenant's sitting", async () => {
      const result = await getSessionScoresTool.execute(
        { session_id: ids.sessionA },
        ctx(clientBDb, false),
      )
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.reason).toBe('not_found')
    })

    it('an aggregate-only campaign hides individual scores from the client, but not from a platform admin', async () => {
      // Nothing in the chat layer knows what a confidentiality mode is. The
      // participant_scores SELECT policy excludes aggregate-only campaigns, so
      // this falls out of running as the caller.
      const asClient = await getSessionScoresTool.execute(
        { session_id: ids.sessionConfidential },
        ctx(clientADb, false),
      )
      expect(asClient.ok).toBe(false)

      const asAdmin = await getSessionScoresTool.execute(
        { session_id: ids.sessionConfidential },
        ctx(adminDb, true),
      )
      expect(asAdmin.ok).toBe(true)
    })

    it('refuses without an identifier rather than guessing', async () => {
      const result = await getSessionScoresTool.execute({}, ctx(adminDb, true))
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.reason).toBe('invalid_input')
    })
  })
})
