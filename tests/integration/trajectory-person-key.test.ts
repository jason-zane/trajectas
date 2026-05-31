/**
 * Integration tests for the trajectory person_key foundation
 * (Phase 1 of docs/superpowers/specs/2026-05-12-trajectory-design.md).
 *
 * Covers:
 *   - the BEFORE INSERT trigger that auto-links person_key on (client_id, email)
 *   - cross-client isolation (same email under two clients = two persons)
 *   - person_link_audit RLS
 *
 * Shares the OTP fixture (createTestUser, host guard) with
 * tests/integration/tenant-isolation.test.ts and org-diagnostic-rls.test.ts
 * via tests/integration/_helpers/rls-fixture.ts.
 *
 * Requires a running Supabase instance with:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  canRun,
  createAdminClient,
  createTestUser,
} from './_helpers/rls-fixture'

const ts = Date.now()

function testEmail(label: string) {
  return `traj-${label}-${ts}@test.local`
}
function testSlug(label: string) {
  // campaigns_slug_format requires lowercase [a-z0-9-]; lowercase any label.
  return `traj-${label}-${ts}`.toLowerCase()
}

describe.skipIf(!canRun)('trajectory person_key foundation', () => {
  const admin = createAdminClient()

  const ids = {
    clientA: '',
    clientB: '',
    campaignA1: '',
    campaignA2: '',
    campaignB1: '',
    // participants set in beforeAll
    cpA1_jane: '',
    cpA2_jane: '',
    cpA1_bob: '',
    cpB1_jane: '',
  }

  // Person keys captured after insert for assertions
  const keys = {
    a1Jane: '',
    a2Jane: '',
    a1Bob: '',
    b1Jane: '',
  }

  let platformAdminDb: SupabaseClient
  let clientAAdminDb: SupabaseClient
  let clientBAdminDb: SupabaseClient
  const authUserIds: string[] = []

  beforeAll(async () => {
    // --- Clients (no partner — both standalone) ---
    const { data: cA, error: cAErr } = await admin
      .from('clients')
      .insert({ name: `Traj Client A ${ts}`, slug: testSlug('cA') })
      .select('id')
      .single()
    if (cAErr) throw new Error(`client A insert failed: ${cAErr.message}`)
    ids.clientA = cA!.id

    const { data: cB, error: cBErr } = await admin
      .from('clients')
      .insert({ name: `Traj Client B ${ts}`, slug: testSlug('cB') })
      .select('id')
      .single()
    if (cBErr) throw new Error(`client B insert failed: ${cBErr.message}`)
    ids.clientB = cB!.id

    // --- Campaigns ---
    const { data: camA1, error: camA1Err } = await admin
      .from('campaigns')
      .insert({
        title: `Campaign A1 ${ts}`,
        slug: testSlug('camA1'),
        client_id: ids.clientA,
      })
      .select('id')
      .single()
    if (camA1Err) throw new Error(`campaign A1 insert failed: ${camA1Err.message}`)
    ids.campaignA1 = camA1!.id

    const { data: camA2, error: camA2Err } = await admin
      .from('campaigns')
      .insert({
        title: `Campaign A2 ${ts}`,
        slug: testSlug('camA2'),
        client_id: ids.clientA,
      })
      .select('id')
      .single()
    if (camA2Err) throw new Error(`campaign A2 insert failed: ${camA2Err.message}`)
    ids.campaignA2 = camA2!.id

    const { data: camB1, error: camB1Err } = await admin
      .from('campaigns')
      .insert({
        title: `Campaign B1 ${ts}`,
        slug: testSlug('camB1'),
        client_id: ids.clientB,
      })
      .select('id')
      .single()
    if (camB1Err) throw new Error(`campaign B1 insert failed: ${camB1Err.message}`)
    ids.campaignB1 = camB1!.id

    // --- Participants ---
    // Jane in A1 — first time, fresh person_key
    const janeEmail = testEmail('jane')
    const { data: a1Jane } = await admin
      .from('campaign_participants')
      .insert({
        campaign_id: ids.campaignA1,
        email: janeEmail,
        first_name: 'Jane',
        last_name: 'Doe',
      })
      .select('id, person_key')
      .single()
    ids.cpA1_jane = a1Jane!.id
    keys.a1Jane = a1Jane!.person_key

    // Jane in A2 — same client, same email → trigger reuses person_key
    const { data: a2Jane } = await admin
      .from('campaign_participants')
      .insert({
        campaign_id: ids.campaignA2,
        email: janeEmail,
        first_name: 'Jane',
        last_name: 'Doe',
      })
      .select('id, person_key')
      .single()
    ids.cpA2_jane = a2Jane!.id
    keys.a2Jane = a2Jane!.person_key

    // Bob in A1 — same client, different email → fresh person_key
    const { data: a1Bob } = await admin
      .from('campaign_participants')
      .insert({
        campaign_id: ids.campaignA1,
        email: testEmail('bob'),
        first_name: 'Bob',
        last_name: 'Bobsworth',
      })
      .select('id, person_key')
      .single()
    ids.cpA1_bob = a1Bob!.id
    keys.a1Bob = a1Bob!.person_key

    // Jane in B1 — DIFFERENT client, same email → fresh person_key (not shared)
    const { data: b1Jane } = await admin
      .from('campaign_participants')
      .insert({
        campaign_id: ids.campaignB1,
        email: janeEmail,
        first_name: 'Jane',
        last_name: 'Doe',
      })
      .select('id, person_key')
      .single()
    ids.cpB1_jane = b1Jane!.id
    keys.b1Jane = b1Jane!.person_key

    // --- Users for RLS assertions ---
    const platformAdmin = await createTestUser(admin, {
      email: testEmail('platform'),
      role: 'platform_admin',
    })
    platformAdminDb = platformAdmin.client
    authUserIds.push(platformAdmin.userId)

    const aAdmin = await createTestUser(admin, {
      email: testEmail('cA-admin'),
      role: 'org_admin',
      clientId: ids.clientA,
    })
    clientAAdminDb = aAdmin.client
    authUserIds.push(aAdmin.userId)
    await admin
      .from('client_memberships')
      .insert({ profile_id: aAdmin.userId, client_id: ids.clientA, role: 'admin' })

    const bAdmin = await createTestUser(admin, {
      email: testEmail('cB-admin'),
      role: 'org_admin',
      clientId: ids.clientB,
    })
    clientBAdminDb = bAdmin.client
    authUserIds.push(bAdmin.userId)
    await admin
      .from('client_memberships')
      .insert({ profile_id: bAdmin.userId, client_id: ids.clientB, role: 'admin' })
  })

  afterAll(async () => {
    if (!canRun) return
    // Children clean up via ON DELETE CASCADE from clients.
    if (ids.clientA) await admin.from('clients').delete().eq('id', ids.clientA)
    if (ids.clientB) await admin.from('clients').delete().eq('id', ids.clientB)
    for (const userId of authUserIds) {
      await admin.auth.admin.deleteUser(userId).catch(() => {})
    }
  })

  // -----------------------------------------------------------------------
  // Trigger behaviour
  // -----------------------------------------------------------------------

  it('reuses person_key for the same email within the same client', () => {
    expect(keys.a2Jane).toBe(keys.a1Jane)
  })

  it('generates a distinct person_key for different emails within a client', () => {
    expect(keys.a1Bob).not.toBe(keys.a1Jane)
  })

  it('does NOT share person_key across different clients', () => {
    expect(keys.b1Jane).not.toBe(keys.a1Jane)
    expect(keys.b1Jane).not.toBe(keys.a2Jane)
  })

  it('generates a UUID for person_key on every row', () => {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    expect(keys.a1Jane).toMatch(uuidRe)
    expect(keys.a1Bob).toMatch(uuidRe)
    expect(keys.b1Jane).toMatch(uuidRe)
  })

  // -----------------------------------------------------------------------
  // Direct SQL: manual merge via admin client
  // -----------------------------------------------------------------------

  it('merges two person_keys via UPDATE (admin path)', async () => {
    // Create a third Jane-with-typo participant whose key starts distinct,
    // then merge into the canonical Jane's key.
    const typoEmail = testEmail('jane-typo')
    const { data: typoJane } = await admin
      .from('campaign_participants')
      .insert({
        campaign_id: ids.campaignA1,
        email: typoEmail,
        first_name: 'Jane',
        last_name: 'Doe-Typo',
      })
      .select('id, person_key')
      .single()
    expect(typoJane!.person_key).not.toBe(keys.a1Jane)

    // Merge by updating
    const { error: updErr } = await admin
      .from('campaign_participants')
      .update({ person_key: keys.a1Jane })
      .eq('person_key', typoJane!.person_key)
    expect(updErr).toBeNull()

    // Verify
    const { data: after } = await admin
      .from('campaign_participants')
      .select('person_key')
      .eq('id', typoJane!.id)
      .single()
    expect(after!.person_key).toBe(keys.a1Jane)

    // Write the audit row (the action does this; we verify the table accepts it)
    const { error: auditErr } = await admin
      .from('person_link_audit')
      .insert({
        client_id: ids.clientA,
        action: 'merge',
        source_person_key: typoJane!.person_key,
        target_person_key: keys.a1Jane,
        affected_participant_ids: [typoJane!.id],
        reason: 'test merge',
      })
    expect(auditErr).toBeNull()
  })

  // -----------------------------------------------------------------------
  // person_link_audit RLS
  // -----------------------------------------------------------------------

  it('platform admin sees audit rows from any client', async () => {
    const { data, error } = await platformAdminDb
      .from('person_link_audit')
      .select('id, client_id')
      .eq('client_id', ids.clientA)
    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThan(0)
  })

  it('client A admin sees audit rows for client A', async () => {
    const { data, error } = await clientAAdminDb
      .from('person_link_audit')
      .select('id, client_id')
      .eq('client_id', ids.clientA)
    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThan(0)
  })

  it('client B admin does NOT see audit rows for client A', async () => {
    const { data, error } = await clientBAdminDb
      .from('person_link_audit')
      .select('id, client_id')
      .eq('client_id', ids.clientA)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  it('client A admin can insert an audit row for client A', async () => {
    // Seed: create a fresh participant pair to merge so we have a real source/target
    const tEmail = testEmail('audit-insert')
    const { data: a1 } = await admin
      .from('campaign_participants')
      .insert({
        campaign_id: ids.campaignA1,
        email: tEmail,
        first_name: 'Audit',
        last_name: 'Subject',
      })
      .select('id, person_key')
      .single()
    const { data: a2 } = await admin
      .from('campaign_participants')
      .insert({
        campaign_id: ids.campaignA2,
        email: tEmail,
        first_name: 'Audit',
        last_name: 'Subject',
      })
      .select('id, person_key')
      .single()
    // (a2 will have been auto-linked to a1's person_key)
    expect(a2!.person_key).toBe(a1!.person_key)

    const { error: insErr } = await clientAAdminDb
      .from('person_link_audit')
      .insert({
        client_id: ids.clientA,
        action: 'merge',
        source_person_key: a2!.person_key,
        target_person_key: a1!.person_key,
        affected_participant_ids: [a1!.id, a2!.id],
        reason: 'client admin self-insert',
      })
    expect(insErr).toBeNull()
  })

  it('client A admin canNOT insert an audit row for client B', async () => {
    const { error } = await clientAAdminDb.from('person_link_audit').insert({
      client_id: ids.clientB,
      action: 'merge',
      source_person_key: keys.b1Jane,
      target_person_key: keys.a1Jane,
      affected_participant_ids: [ids.cpB1_jane],
      reason: 'cross-client attempt',
    })
    // RLS denies via WITH CHECK
    expect(error).not.toBeNull()
  })
})
