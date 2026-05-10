/**
 * Constraint and lifecycle integration tests for the Org Diagnostic feature.
 *
 * Uses the service-role admin client (RLS bypassed) — these tests focus on
 * data integrity, not access control. RLS is covered in
 * tests/integration/org-diagnostic-rls.test.ts.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

function loadEnvFile() {
  try {
    const envPath = resolve(__dirname, '../../.env.local')
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx)
      const value = trimmed.slice(eqIdx + 1)
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // .env.local not present — rely on process.env
  }
}

loadEnvFile()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const canRun = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY)
const ts = Date.now()
function testSlug(label: string) {
  return `lc-orgdiag-${label}-${ts}`
}

describe.skipIf(!canRun)('Org Diagnostic Lifecycle', () => {
  const admin: SupabaseClient = canRun
    ? createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!)
    : (null as never)

  let clientId: string
  let partnerId: string

  beforeAll(async () => {
    const { data: p, error: pErr } = await admin
      .from('partners')
      .insert({ name: `LC Partner ${ts}`, slug: testSlug('partner') })
      .select('id')
      .single()
    if (pErr) throw new Error(`partner insert failed: ${pErr.message}`)
    partnerId = p!.id

    const { data: c, error: cErr } = await admin
      .from('clients')
      .insert({ name: `LC Client ${ts}`, slug: testSlug('client'), partner_id: partnerId })
      .select('id')
      .single()
    if (cErr) throw new Error(`client insert failed: ${cErr.message}`)
    clientId = c!.id
  })

  afterAll(async () => {
    // Best-effort cleanup. Tests should clean up their own per-test rows;
    // these final deletes catch the partner+client only.
    if (clientId) await admin.from('clients').delete().eq('id', clientId)
    if (partnerId) await admin.from('partners').delete().eq('id', partnerId)
  })

  // -------------------------------------------------------------------------
  // E2: Campaign kind consistency CHECK
  // -------------------------------------------------------------------------
  describe('Campaign kind consistency CHECK', () => {
    it('rejects baseline campaign with client_role_id set', async () => {
      // Bootstrap: a valid baseline campaign + snapshot + role to reference
      const { data: bootstrapCampaign } = await admin
        .from('org_diagnostic_campaigns')
        .insert({ client_id: clientId, kind: 'baseline', title: 'Bootstrap', status: 'draft' })
        .select('id')
        .single()
      const { data: snap } = await admin
        .from('org_diagnostic_profiles')
        .insert({
          client_id: clientId,
          campaign_id: bootstrapCampaign!.id,
          kind: 'baseline',
          data: {},
          respondent_count: 0,
        })
        .select('id')
        .single()
      const { data: role } = await admin
        .from('client_roles')
        .insert({
          client_id: clientId,
          title: 'Bootstrap Role',
          pinned_baseline_snapshot_id: snap!.id,
        })
        .select('id')
        .single()

      // The actual test: baseline + client_role_id should be rejected
      const { error } = await admin.from('org_diagnostic_campaigns').insert({
        client_id: clientId,
        kind: 'baseline',
        title: 'Bad baseline',
        status: 'draft',
        client_role_id: role!.id,
      })
      expect(error).not.toBeNull()
      expect(error!.message).toMatch(/org_diag_campaigns_kind_consistency/)

      // Cleanup
      await admin.from('client_roles').delete().eq('id', role!.id)
      await admin.from('org_diagnostic_profiles').delete().eq('id', snap!.id)
      await admin.from('org_diagnostic_campaigns').delete().eq('id', bootstrapCampaign!.id)
    })

    it('rejects role_rep campaign with no client_role_id', async () => {
      const { error } = await admin.from('org_diagnostic_campaigns').insert({
        client_id: clientId,
        kind: 'role_rep',
        title: 'Bad role_rep',
        status: 'draft',
      })
      expect(error).not.toBeNull()
      expect(error!.message).toMatch(/org_diag_campaigns_kind_consistency/)
    })
  })

  // -------------------------------------------------------------------------
  // E3: Track uniqueness per (campaign, instrument)
  // -------------------------------------------------------------------------
  describe('Track uniqueness', () => {
    it('rejects two OPS tracks on the same campaign', async () => {
      const { data: campaign } = await admin
        .from('org_diagnostic_campaigns')
        .insert({ client_id: clientId, kind: 'baseline', title: 'Unique track test', status: 'draft' })
        .select('id')
        .single()

      const { error: e1 } = await admin.from('org_diagnostic_campaign_tracks').insert({
        campaign_id: campaign!.id,
        instrument: 'OPS',
      })
      expect(e1).toBeNull()

      const { error: e2 } = await admin.from('org_diagnostic_campaign_tracks').insert({
        campaign_id: campaign!.id,
        instrument: 'OPS',
      })
      expect(e2).not.toBeNull()
      expect(e2!.message).toMatch(/org_diag_tracks_unique/)

      await admin.from('org_diagnostic_campaigns').delete().eq('id', campaign!.id)
    })
  })

  // -------------------------------------------------------------------------
  // E4: Snapshot deletion guarded by role pinning
  // -------------------------------------------------------------------------
  describe('Snapshot deletion guarded by role pinning', () => {
    it('cannot delete a snapshot while a role pins it; succeeds after role re-pinned', async () => {
      const { data: campaign } = await admin
        .from('org_diagnostic_campaigns')
        .insert({ client_id: clientId, kind: 'baseline', title: 'Pin test', status: 'closed' })
        .select('id')
        .single()
      const { data: snapshot } = await admin
        .from('org_diagnostic_profiles')
        .insert({
          client_id: clientId,
          campaign_id: campaign!.id,
          kind: 'baseline',
          data: {},
          respondent_count: 0,
        })
        .select('id')
        .single()
      const { data: role } = await admin
        .from('client_roles')
        .insert({
          client_id: clientId,
          title: 'Pinned Role',
          pinned_baseline_snapshot_id: snapshot!.id,
        })
        .select('id')
        .single()

      // Try to delete the pinned snapshot — should fail with FK RESTRICT
      const { error: deleteWhilePinned } = await admin
        .from('org_diagnostic_profiles')
        .delete()
        .eq('id', snapshot!.id)
      expect(deleteWhilePinned).not.toBeNull()
      expect(deleteWhilePinned!.message).toMatch(/foreign key|violates|restrict/i)

      // Re-pin role to a different snapshot
      const { data: campaign2 } = await admin
        .from('org_diagnostic_campaigns')
        .insert({ client_id: clientId, kind: 'baseline', title: 'Repin target', status: 'closed' })
        .select('id')
        .single()
      const { data: snapshot2 } = await admin
        .from('org_diagnostic_profiles')
        .insert({
          client_id: clientId,
          campaign_id: campaign2!.id,
          kind: 'baseline',
          data: {},
          respondent_count: 0,
        })
        .select('id')
        .single()
      const { error: repinError } = await admin
        .from('client_roles')
        .update({ pinned_baseline_snapshot_id: snapshot2!.id })
        .eq('id', role!.id)
      expect(repinError).toBeNull()

      // Now the original snapshot can be deleted
      const { error: deleteAfterRepin } = await admin
        .from('org_diagnostic_profiles')
        .delete()
        .eq('id', snapshot!.id)
      expect(deleteAfterRepin).toBeNull()

      // Cleanup
      await admin.from('client_roles').delete().eq('id', role!.id)
      await admin.from('org_diagnostic_profiles').delete().eq('id', snapshot2!.id)
      await admin
        .from('org_diagnostic_campaigns')
        .delete()
        .in('id', [campaign!.id, campaign2!.id])
    })
  })

  // -------------------------------------------------------------------------
  // E5: Snapshot uniqueness per campaign
  // -------------------------------------------------------------------------
  describe('Snapshot uniqueness per campaign', () => {
    it('rejects a second snapshot for the same campaign', async () => {
      const { data: campaign } = await admin
        .from('org_diagnostic_campaigns')
        .insert({ client_id: clientId, kind: 'baseline', title: 'Snap uniqueness test', status: 'closed' })
        .select('id')
        .single()

      const { error: e1 } = await admin.from('org_diagnostic_profiles').insert({
        client_id: clientId,
        campaign_id: campaign!.id,
        kind: 'baseline',
        data: {},
        respondent_count: 0,
      })
      expect(e1).toBeNull()

      const { error: e2 } = await admin.from('org_diagnostic_profiles').insert({
        client_id: clientId,
        campaign_id: campaign!.id,
        kind: 'baseline',
        data: {},
        respondent_count: 0,
      })
      expect(e2).not.toBeNull()
      expect(e2!.message).toMatch(/org_diagnostic_profiles_campaign_unique/)

      await admin.from('org_diagnostic_profiles').delete().eq('campaign_id', campaign!.id)
      await admin.from('org_diagnostic_campaigns').delete().eq('id', campaign!.id)
    })
  })

  // -------------------------------------------------------------------------
  // E6: Profile pin consistency CHECK
  // -------------------------------------------------------------------------
  describe('Profile pin consistency CHECK', () => {
    it('rejects role-kind snapshot without pinned_baseline_snapshot_id', async () => {
      const { data: campaign } = await admin
        .from('org_diagnostic_campaigns')
        .insert({ client_id: clientId, kind: 'baseline', title: 'Pin consistency null', status: 'closed' })
        .select('id')
        .single()

      const { error } = await admin.from('org_diagnostic_profiles').insert({
        client_id: clientId,
        campaign_id: campaign!.id,
        kind: 'role',
        data: {},
        respondent_count: 0,
      })
      expect(error).not.toBeNull()
      expect(error!.message).toMatch(/org_diagnostic_profiles_pin_consistency/)

      await admin.from('org_diagnostic_campaigns').delete().eq('id', campaign!.id)
    })

    it('rejects baseline-kind snapshot WITH pinned_baseline_snapshot_id', async () => {
      const { data: bootstrapCampaign } = await admin
        .from('org_diagnostic_campaigns')
        .insert({ client_id: clientId, kind: 'baseline', title: 'Pin consistency bootstrap', status: 'closed' })
        .select('id')
        .single()
      const { data: realSnap } = await admin
        .from('org_diagnostic_profiles')
        .insert({
          client_id: clientId,
          campaign_id: bootstrapCampaign!.id,
          kind: 'baseline',
          data: {},
          respondent_count: 0,
        })
        .select('id')
        .single()

      const { data: badCampaign } = await admin
        .from('org_diagnostic_campaigns')
        .insert({ client_id: clientId, kind: 'baseline', title: 'Self-pin attempt', status: 'closed' })
        .select('id')
        .single()
      const { error } = await admin.from('org_diagnostic_profiles').insert({
        client_id: clientId,
        campaign_id: badCampaign!.id,
        kind: 'baseline',
        pinned_baseline_snapshot_id: realSnap!.id,
        data: {},
        respondent_count: 0,
      })
      expect(error).not.toBeNull()
      expect(error!.message).toMatch(/org_diagnostic_profiles_pin_consistency/)

      // Cleanup
      await admin.from('org_diagnostic_profiles').delete().eq('id', realSnap!.id)
      await admin
        .from('org_diagnostic_campaigns')
        .delete()
        .in('id', [bootstrapCampaign!.id, badCampaign!.id])
    })
  })
})
