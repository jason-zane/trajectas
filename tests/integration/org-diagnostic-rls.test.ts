/**
 * RLS verification tests for the Org Diagnostic feature.
 *
 * The anonymity contract (spec §1.6) is the most important assertion:
 * client members and partner admins must NEVER be able to SELECT from
 * org_diagnostic_respondents — only the platform admin can.
 *
 * Mirrors the fixture and helper patterns of tests/integration/tenant-isolation.test.ts.
 * The createTestUser helper is duplicated here intentionally; if a third RLS test
 * file appears, extract to tests/integration/_helpers/rls-fixture.ts.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// Environment loading (same pattern as tenant-isolation.test.ts)
// ---------------------------------------------------------------------------

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
    // .env.local not present — rely on process.env (e.g. CI)
  }
}

loadEnvFile()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const canRun = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY && SUPABASE_ANON_KEY)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_PASSWORD = 'test-rls-orgdiag-pw-123!'
const ts = Date.now()
function testEmail(label: string) {
  return `rls-orgdiag-${label}-${ts}@test.local`
}
function testSlug(label: string) {
  return `rls-orgdiag-${label}-${ts}`
}

async function createTestUser(
  admin: SupabaseClient,
  opts: {
    email: string
    role: 'platform_admin' | 'partner_admin' | 'org_admin' | 'consultant'
    partnerId?: string
    clientId?: string
  },
): Promise<{ userId: string; client: SupabaseClient }> {
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: opts.email,
    password: TEST_PASSWORD,
    email_confirm: true,
  })
  if (createErr || !created.user) {
    throw new Error(`Failed to create auth user ${opts.email}: ${createErr?.message}`)
  }
  const userId = created.user.id

  const { error: profileErr } = await admin.from('profiles').insert({
    id: userId,
    email: opts.email,
    role: opts.role,
    partner_id: opts.partnerId ?? null,
    client_id: opts.clientId ?? null,
    first_name: 'Test',
    last_name: opts.role,
  })
  if (profileErr) {
    throw new Error(`Failed to create profile for ${opts.email}: ${profileErr.message}`)
  }

  const userClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
  const { error: signInErr } = await userClient.auth.signInWithPassword({
    email: opts.email,
    password: TEST_PASSWORD,
  })
  if (signInErr) {
    throw new Error(`Failed to sign in as ${opts.email}: ${signInErr.message}`)
  }

  return { userId, client: userClient }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe.skipIf(!canRun)('Org Diagnostic RLS', () => {
  const admin: SupabaseClient = canRun
    ? createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!)
    : (null as never)

  let platformAdminClient: SupabaseClient
  let clientAAdminClient: SupabaseClient
  let clientBAdminClient: SupabaseClient
  let partnerAdminClient: SupabaseClient

  const ids = {
    partner: '',
    clientA: '',
    clientB: '',
    snapshotA: '',
    campaignA: '',
    trackA: '',
    respondent1: '',
    respondent2: '',
    roleA: '',
  }

  const authUserIds: string[] = []

  beforeAll(async () => {
    // --- Partner ---
    const { data: p } = await admin
      .from('partners')
      .insert({ name: `OrgDiag Partner ${ts}`, slug: testSlug('partner') })
      .select('id')
      .single()
    ids.partner = p!.id

    // --- Clients ---
    const { data: cA } = await admin
      .from('clients')
      .insert({ name: `Client A ${ts}`, slug: testSlug('clientA'), partner_id: ids.partner })
      .select('id')
      .single()
    ids.clientA = cA!.id

    const { data: cB } = await admin
      .from('clients')
      .insert({ name: `Client B ${ts}`, slug: testSlug('clientB'), partner_id: ids.partner })
      .select('id')
      .single()
    ids.clientB = cB!.id

    // --- Users ---
    const platformAdmin = await createTestUser(admin, {
      email: testEmail('platform'),
      role: 'platform_admin',
    })
    platformAdminClient = platformAdmin.client
    authUserIds.push(platformAdmin.userId)

    const clientAAdmin = await createTestUser(admin, {
      email: testEmail('clientA-admin'),
      role: 'org_admin',
      clientId: ids.clientA,
    })
    clientAAdminClient = clientAAdmin.client
    authUserIds.push(clientAAdmin.userId)

    const clientBAdmin = await createTestUser(admin, {
      email: testEmail('clientB-admin'),
      role: 'org_admin',
      clientId: ids.clientB,
    })
    clientBAdminClient = clientBAdmin.client
    authUserIds.push(clientBAdmin.userId)

    const partnerAdmin = await createTestUser(admin, {
      email: testEmail('partner-admin'),
      role: 'partner_admin',
      partnerId: ids.partner,
    })
    partnerAdminClient = partnerAdmin.client
    authUserIds.push(partnerAdmin.userId)

    // --- Diagnostic data for clientA ---
    // Campaign first (snapshot has FK to campaign)
    const { data: campA, error: campErr } = await admin
      .from('org_diagnostic_campaigns')
      .insert({
        client_id: ids.clientA,
        kind: 'baseline',
        title: `Test Baseline Campaign A ${ts}`,
        status: 'closed',
      })
      .select('id')
      .single()
    if (campErr) throw new Error(`campaign insert failed: ${campErr.message}`)
    ids.campaignA = campA!.id

    // Snapshot for the campaign
    const { data: snapA } = await admin
      .from('org_diagnostic_profiles')
      .insert({
        client_id: ids.clientA,
        campaign_id: ids.campaignA,
        kind: 'baseline',
        data: {},
        respondent_count: 2,
        respondent_count_by_type: { employee: 2 },
      })
      .select('id')
      .single()
    ids.snapshotA = snapA!.id

    // Track for the campaign
    const { data: trackA } = await admin
      .from('org_diagnostic_campaign_tracks')
      .insert({ campaign_id: ids.campaignA, instrument: 'OPS', status: 'closed' })
      .select('id')
      .single()
    ids.trackA = trackA!.id

    // Two respondents
    const { data: r1 } = await admin
      .from('org_diagnostic_respondents')
      .insert({
        campaign_id: ids.campaignA,
        track_id: ids.trackA,
        respondent_type: 'employee',
        email: `r1-${ts}@test.local`,
      })
      .select('id')
      .single()
    ids.respondent1 = r1!.id

    const { data: r2 } = await admin
      .from('org_diagnostic_respondents')
      .insert({
        campaign_id: ids.campaignA,
        track_id: ids.trackA,
        respondent_type: 'employee',
        email: `r2-${ts}@test.local`,
      })
      .select('id')
      .single()
    ids.respondent2 = r2!.id

    // Role pinned to the snapshot
    const { data: role } = await admin
      .from('client_roles')
      .insert({
        client_id: ids.clientA,
        title: 'Test Role A',
        pinned_baseline_snapshot_id: ids.snapshotA,
      })
      .select('id')
      .single()
    ids.roleA = role!.id
  })

  afterAll(async () => {
    // FK order: role -> snapshot -> campaign (cascades to tracks + respondents)
    if (ids.roleA) await admin.from('client_roles').delete().eq('id', ids.roleA)
    if (ids.snapshotA) await admin.from('org_diagnostic_profiles').delete().eq('id', ids.snapshotA)
    if (ids.campaignA) await admin.from('org_diagnostic_campaigns').delete().eq('id', ids.campaignA)
    if (ids.clientA) await admin.from('clients').delete().eq('id', ids.clientA)
    if (ids.clientB) await admin.from('clients').delete().eq('id', ids.clientB)
    if (ids.partner) await admin.from('partners').delete().eq('id', ids.partner)
    for (const uid of authUserIds) {
      await admin.auth.admin.deleteUser(uid).catch(() => undefined)
    }
  })

  // -------------------------------------------------------------------------
  // D3: Anonymity contract — THE critical test
  // -------------------------------------------------------------------------
  describe('Anonymity contract — org_diagnostic_respondents', () => {
    it('platform admin CAN select all respondents', async () => {
      const { data, error } = await platformAdminClient
        .from('org_diagnostic_respondents')
        .select('id, email')
        .eq('campaign_id', ids.campaignA)
      expect(error).toBeNull()
      expect(data).toHaveLength(2)
    })

    it('client_admin of the OWNING client cannot SELECT any respondents', async () => {
      const { data, error } = await clientAAdminClient
        .from('org_diagnostic_respondents')
        .select('id, email')
        .eq('campaign_id', ids.campaignA)
      expect(error).toBeNull()
      expect(data).toEqual([])
    })

    it('client_admin of a DIFFERENT client also cannot SELECT', async () => {
      const { data, error } = await clientBAdminClient
        .from('org_diagnostic_respondents')
        .select('id, email')
        .eq('campaign_id', ids.campaignA)
      expect(error).toBeNull()
      expect(data).toEqual([])
    })

    it('partner_admin still CANNOT SELECT respondents (anonymity holds across roles)', async () => {
      const { data } = await partnerAdminClient
        .from('org_diagnostic_respondents')
        .select('id')
        .eq('campaign_id', ids.campaignA)
      expect(data ?? []).toEqual([])
    })

    it('anonymous client also cannot SELECT', async () => {
      const anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
      const { data } = await anon
        .from('org_diagnostic_respondents')
        .select('id')
        .eq('campaign_id', ids.campaignA)
      expect(data ?? []).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  // D4: Cross-client isolation
  // -------------------------------------------------------------------------
  describe('Cross-client isolation', () => {
    describe('org_diagnostic_campaigns', () => {
      it('client_admin of OWNING client can SELECT', async () => {
        const { data } = await clientAAdminClient
          .from('org_diagnostic_campaigns')
          .select('id')
          .eq('id', ids.campaignA)
        expect(data).toHaveLength(1)
      })

      it('client_admin of DIFFERENT client cannot SELECT', async () => {
        const { data } = await clientBAdminClient
          .from('org_diagnostic_campaigns')
          .select('id')
          .eq('id', ids.campaignA)
        expect(data ?? []).toEqual([])
      })
    })

    describe('org_diagnostic_profiles', () => {
      it('client_admin of OWNING client can SELECT snapshot', async () => {
        const { data } = await clientAAdminClient
          .from('org_diagnostic_profiles')
          .select('id')
          .eq('id', ids.snapshotA)
        expect(data).toHaveLength(1)
      })

      it('client_admin of DIFFERENT client cannot SELECT', async () => {
        const { data } = await clientBAdminClient
          .from('org_diagnostic_profiles')
          .select('id')
          .eq('id', ids.snapshotA)
        expect(data ?? []).toEqual([])
      })
    })

    describe('client_roles', () => {
      it('client_admin of OWNING client can SELECT role', async () => {
        const { data } = await clientAAdminClient
          .from('client_roles')
          .select('id')
          .eq('id', ids.roleA)
        expect(data).toHaveLength(1)
      })

      it('client_admin of DIFFERENT client cannot SELECT', async () => {
        const { data } = await clientBAdminClient
          .from('client_roles')
          .select('id')
          .eq('id', ids.roleA)
        expect(data ?? []).toEqual([])
      })
    })

    describe('org_diagnostic_campaign_tracks', () => {
      it('client_admin of OWNING client can SELECT track via campaign', async () => {
        const { data } = await clientAAdminClient
          .from('org_diagnostic_campaign_tracks')
          .select('id')
          .eq('id', ids.trackA)
        expect(data).toHaveLength(1)
      })

      it('client_admin of DIFFERENT client cannot SELECT', async () => {
        const { data } = await clientBAdminClient
          .from('org_diagnostic_campaign_tracks')
          .select('id')
          .eq('id', ids.trackA)
        expect(data ?? []).toEqual([])
      })
    })
  })

  // -------------------------------------------------------------------------
  // D5: Partner-admin read access
  // -------------------------------------------------------------------------
  describe('Partner-admin read access', () => {
    it('partner_admin can SELECT campaigns of their partner\'s clients', async () => {
      const { data } = await partnerAdminClient
        .from('org_diagnostic_campaigns')
        .select('id')
        .eq('id', ids.campaignA)
      expect(data).toHaveLength(1)
    })

    it('partner_admin can SELECT profiles of their partner\'s clients', async () => {
      const { data } = await partnerAdminClient
        .from('org_diagnostic_profiles')
        .select('id')
        .eq('id', ids.snapshotA)
      expect(data).toHaveLength(1)
    })

    it('partner_admin can SELECT roles of their partner\'s clients', async () => {
      const { data } = await partnerAdminClient
        .from('client_roles')
        .select('id')
        .eq('id', ids.roleA)
      expect(data).toHaveLength(1)
    })

    it('partner_admin can SELECT tracks of their partner\'s clients', async () => {
      const { data } = await partnerAdminClient
        .from('org_diagnostic_campaign_tracks')
        .select('id')
        .eq('id', ids.trackA)
      expect(data).toHaveLength(1)
    })
  })
})
