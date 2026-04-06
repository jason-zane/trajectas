/**
 * Integration tests for RLS tenant isolation.
 *
 * Verifies that Supabase RLS policies correctly filter data when different
 * actors (client admin, partner admin, platform admin) query through the
 * authenticated anon-key client.
 *
 * Fixture hierarchy:
 *   Partner A
 *     ├── Client A1  →  Campaign A1-C1  (+ 1 participant)
 *     └── Client A2  →  Campaign A2-C1
 *   Partner B
 *     └── Client B1  →  Campaign B1-C1
 *
 * Requires a running Supabase instance (local or remote) with env vars:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Environment — load from .env.local if variables are not already present
// ---------------------------------------------------------------------------

function loadEnvFile() {
  try {
    const envPath = resolve(__dirname, "../../.env.local");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx);
      const value = trimmed.slice(eqIdx + 1);
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env.local not present — rely on process.env
  }
}

loadEnvFile();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const canRun = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY && SUPABASE_ANON_KEY);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_PASSWORD = "test-rls-isolation-pw-123!";
const ts = Date.now();

/** Build a deterministic, collision-safe email address for a test actor. */
function testEmail(label: string) {
  return `rls-${label}-${ts}@test.local`;
}

/** Build a collision-safe slug. */
function testSlug(label: string) {
  return `rls-${label}-${ts}`;
}

/**
 * Create a Supabase auth user, its profile, and return an authenticated client.
 * The admin client is used for all privileged setup; the returned client uses
 * the anon key and signs in with the user's credentials.
 */
async function createTestUser(
  admin: SupabaseClient,
  opts: {
    email: string;
    role: "platform_admin" | "partner_admin" | "org_admin" | "consultant";
    partnerId?: string;
    clientId?: string;
  },
): Promise<{ userId: string; client: SupabaseClient }> {
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: opts.email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    throw new Error(`Failed to create auth user ${opts.email}: ${createErr?.message}`);
  }

  const userId = created.user.id;

  // Insert profile row via admin client (bypasses RLS)
  const { error: profileErr } = await admin.from("profiles").insert({
    id: userId,
    email: opts.email,
    role: opts.role,
    partner_id: opts.partnerId ?? null,
    client_id: opts.clientId ?? null,
    first_name: "Test",
    last_name: opts.role,
  });
  if (profileErr) {
    throw new Error(`Failed to create profile for ${opts.email}: ${profileErr.message}`);
  }

  // Sign in with the anon key to get an RLS-scoped client
  const userClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  const { error: signInErr } = await userClient.auth.signInWithPassword({
    email: opts.email,
    password: TEST_PASSWORD,
  });
  if (signInErr) {
    throw new Error(`Failed to sign in as ${opts.email}: ${signInErr.message}`);
  }

  return { userId, client: userClient };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe.skipIf(!canRun)("tenant isolation (RLS)", () => {
  // Admin client for setup / teardown (service role bypasses RLS)
  const adminDb = canRun ? createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!) : (null as never);

  // Authenticated clients per actor
  let platformAdminDb: SupabaseClient;
  let partnerAAdminDb: SupabaseClient;
  let clientA1AdminDb: SupabaseClient;
  let clientB1AdminDb: SupabaseClient;

  // IDs to assert against
  const ids = {
    partnerA: "",
    partnerB: "",
    clientA1: "",
    clientA2: "",
    clientB1: "",
    campaignA1C1: "",
    campaignA2C1: "",
    campaignB1C1: "",
    participantA1: "",
  };

  // Track auth user IDs for cleanup
  const authUserIds: string[] = [];

  // -----------------------------------------------------------------------
  // Setup
  // -----------------------------------------------------------------------
  beforeAll(async () => {
    // --- Partners ---
    const { data: pA } = await adminDb
      .from("partners")
      .insert({ name: `Partner A ${ts}`, slug: testSlug("pa") })
      .select("id")
      .single();
    ids.partnerA = pA!.id;

    const { data: pB } = await adminDb
      .from("partners")
      .insert({ name: `Partner B ${ts}`, slug: testSlug("pb") })
      .select("id")
      .single();
    ids.partnerB = pB!.id;

    // --- Clients ---
    const { data: cA1 } = await adminDb
      .from("clients")
      .insert({
        name: `Client A1 ${ts}`,
        slug: testSlug("ca1"),
        partner_id: ids.partnerA,
      })
      .select("id")
      .single();
    ids.clientA1 = cA1!.id;

    const { data: cA2 } = await adminDb
      .from("clients")
      .insert({
        name: `Client A2 ${ts}`,
        slug: testSlug("ca2"),
        partner_id: ids.partnerA,
      })
      .select("id")
      .single();
    ids.clientA2 = cA2!.id;

    const { data: cB1 } = await adminDb
      .from("clients")
      .insert({
        name: `Client B1 ${ts}`,
        slug: testSlug("cb1"),
        partner_id: ids.partnerB,
      })
      .select("id")
      .single();
    ids.clientB1 = cB1!.id;

    // --- Campaigns ---
    const { data: camA1 } = await adminDb
      .from("campaigns")
      .insert({
        title: `Campaign A1-C1 ${ts}`,
        slug: testSlug("cam-a1c1"),
        client_id: ids.clientA1,
        partner_id: ids.partnerA,
      })
      .select("id")
      .single();
    ids.campaignA1C1 = camA1!.id;

    const { data: camA2 } = await adminDb
      .from("campaigns")
      .insert({
        title: `Campaign A2-C1 ${ts}`,
        slug: testSlug("cam-a2c1"),
        client_id: ids.clientA2,
        partner_id: ids.partnerA,
      })
      .select("id")
      .single();
    ids.campaignA2C1 = camA2!.id;

    const { data: camB1 } = await adminDb
      .from("campaigns")
      .insert({
        title: `Campaign B1-C1 ${ts}`,
        slug: testSlug("cam-b1c1"),
        client_id: ids.clientB1,
        partner_id: ids.partnerB,
      })
      .select("id")
      .single();
    ids.campaignB1C1 = camB1!.id;

    // --- Participant on campaign A1-C1 ---
    const { data: part } = await adminDb
      .from("campaign_participants")
      .insert({
        campaign_id: ids.campaignA1C1,
        email: testEmail("participant"),
        first_name: "Jane",
        last_name: "Doe",
      })
      .select("id")
      .single();
    ids.participantA1 = part!.id;

    // --- Auth users + profiles + memberships ---

    // Platform admin
    const platformAdmin = await createTestUser(adminDb, {
      email: testEmail("platform-admin"),
      role: "platform_admin",
    });
    platformAdminDb = platformAdmin.client;
    authUserIds.push(platformAdmin.userId);

    // Partner A admin
    const partnerAAdmin = await createTestUser(adminDb, {
      email: testEmail("partner-a-admin"),
      role: "partner_admin",
      partnerId: ids.partnerA,
    });
    partnerAAdminDb = partnerAAdmin.client;
    authUserIds.push(partnerAAdmin.userId);

    // Create partner membership for Partner A admin
    await adminDb.from("partner_memberships").insert({
      profile_id: partnerAAdmin.userId,
      partner_id: ids.partnerA,
      role: "admin",
    });

    // Client A1 admin
    const clientA1Admin = await createTestUser(adminDb, {
      email: testEmail("client-a1-admin"),
      role: "org_admin",
      clientId: ids.clientA1,
    });
    clientA1AdminDb = clientA1Admin.client;
    authUserIds.push(clientA1Admin.userId);

    // Create client membership for Client A1 admin
    await adminDb.from("client_memberships").insert({
      profile_id: clientA1Admin.userId,
      client_id: ids.clientA1,
      role: "admin",
    });

    // Client B1 admin
    const clientB1Admin = await createTestUser(adminDb, {
      email: testEmail("client-b1-admin"),
      role: "org_admin",
      clientId: ids.clientB1,
    });
    clientB1AdminDb = clientB1Admin.client;
    authUserIds.push(clientB1Admin.userId);

    // Create client membership for Client B1 admin
    await adminDb.from("client_memberships").insert({
      profile_id: clientB1Admin.userId,
      client_id: ids.clientB1,
      role: "admin",
    });
  }, 30_000);

  // -----------------------------------------------------------------------
  // Teardown
  // -----------------------------------------------------------------------
  afterAll(async () => {
    if (!canRun) return;

    // Delete in dependency order: participants, campaigns, clients, partners,
    // memberships, profiles, auth users

    await adminDb
      .from("campaign_participants")
      .delete()
      .in("campaign_id", [ids.campaignA1C1, ids.campaignA2C1, ids.campaignB1C1]);

    await adminDb
      .from("campaigns")
      .delete()
      .in("id", [ids.campaignA1C1, ids.campaignA2C1, ids.campaignB1C1]);

    await adminDb
      .from("client_memberships")
      .delete()
      .in("client_id", [ids.clientA1, ids.clientA2, ids.clientB1]);

    await adminDb
      .from("partner_memberships")
      .delete()
      .in("partner_id", [ids.partnerA, ids.partnerB]);

    await adminDb
      .from("clients")
      .delete()
      .in("id", [ids.clientA1, ids.clientA2, ids.clientB1]);

    await adminDb
      .from("partners")
      .delete()
      .in("id", [ids.partnerA, ids.partnerB]);

    // Profiles and auth users
    for (const uid of authUserIds) {
      await adminDb.from("profiles").delete().eq("id", uid);
      await adminDb.auth.admin.deleteUser(uid);
    }
  }, 15_000);

  // -----------------------------------------------------------------------
  // Client admin isolation
  // -----------------------------------------------------------------------
  describe("client admin isolation", () => {
    it("client A1 admin sees only A1 campaigns", async () => {
      const { data, error } = await clientA1AdminDb.from("campaigns").select("id");
      expect(error).toBeNull();
      const returnedIds = (data ?? []).map((r) => r.id);
      expect(returnedIds).toContain(ids.campaignA1C1);
      expect(returnedIds).not.toContain(ids.campaignA2C1);
      expect(returnedIds).not.toContain(ids.campaignB1C1);
    });

    it("client B1 admin sees only B1 campaigns", async () => {
      const { data, error } = await clientB1AdminDb.from("campaigns").select("id");
      expect(error).toBeNull();
      const returnedIds = (data ?? []).map((r) => r.id);
      expect(returnedIds).toContain(ids.campaignB1C1);
      expect(returnedIds).not.toContain(ids.campaignA1C1);
      expect(returnedIds).not.toContain(ids.campaignA2C1);
    });

    it("client A1 admin cannot see other clients", async () => {
      const { data, error } = await clientA1AdminDb.from("clients").select("id");
      expect(error).toBeNull();
      const returnedIds = (data ?? []).map((r) => r.id);
      expect(returnedIds).toContain(ids.clientA1);
      expect(returnedIds).not.toContain(ids.clientA2);
      expect(returnedIds).not.toContain(ids.clientB1);
    });

    it("client B1 admin cannot see client A1", async () => {
      const { data, error } = await clientB1AdminDb.from("clients").select("id");
      expect(error).toBeNull();
      const returnedIds = (data ?? []).map((r) => r.id);
      expect(returnedIds).toContain(ids.clientB1);
      expect(returnedIds).not.toContain(ids.clientA1);
    });
  });

  // -----------------------------------------------------------------------
  // Partner admin isolation
  // -----------------------------------------------------------------------
  describe("partner admin isolation", () => {
    it("partner A admin sees A1 and A2 campaigns", async () => {
      const { data, error } = await partnerAAdminDb.from("campaigns").select("id");
      expect(error).toBeNull();
      const returnedIds = (data ?? []).map((r) => r.id);
      expect(returnedIds).toContain(ids.campaignA1C1);
      expect(returnedIds).toContain(ids.campaignA2C1);
    });

    it("partner A admin cannot see partner B campaigns", async () => {
      const { data, error } = await partnerAAdminDb.from("campaigns").select("id");
      expect(error).toBeNull();
      const returnedIds = (data ?? []).map((r) => r.id);
      expect(returnedIds).not.toContain(ids.campaignB1C1);
    });

    it("partner A admin sees only their own clients", async () => {
      const { data, error } = await partnerAAdminDb.from("clients").select("id");
      expect(error).toBeNull();
      const returnedIds = (data ?? []).map((r) => r.id);
      expect(returnedIds).toContain(ids.clientA1);
      expect(returnedIds).toContain(ids.clientA2);
      expect(returnedIds).not.toContain(ids.clientB1);
    });

    it("partner A admin can see their own partner record", async () => {
      const { data, error } = await partnerAAdminDb.from("partners").select("id");
      expect(error).toBeNull();
      const returnedIds = (data ?? []).map((r) => r.id);
      expect(returnedIds).toContain(ids.partnerA);
      expect(returnedIds).not.toContain(ids.partnerB);
    });
  });

  // -----------------------------------------------------------------------
  // Platform admin access
  // -----------------------------------------------------------------------
  describe("platform admin access", () => {
    it("platform admin sees all campaigns", async () => {
      const { data, error } = await platformAdminDb.from("campaigns").select("id");
      expect(error).toBeNull();
      const returnedIds = (data ?? []).map((r) => r.id);
      expect(returnedIds).toContain(ids.campaignA1C1);
      expect(returnedIds).toContain(ids.campaignA2C1);
      expect(returnedIds).toContain(ids.campaignB1C1);
    });

    it("platform admin sees all clients", async () => {
      const { data, error } = await platformAdminDb.from("clients").select("id");
      expect(error).toBeNull();
      const returnedIds = (data ?? []).map((r) => r.id);
      expect(returnedIds).toContain(ids.clientA1);
      expect(returnedIds).toContain(ids.clientA2);
      expect(returnedIds).toContain(ids.clientB1);
    });

    it("platform admin sees all partners", async () => {
      const { data, error } = await platformAdminDb.from("partners").select("id");
      expect(error).toBeNull();
      const returnedIds = (data ?? []).map((r) => r.id);
      expect(returnedIds).toContain(ids.partnerA);
      expect(returnedIds).toContain(ids.partnerB);
    });
  });

  // -----------------------------------------------------------------------
  // Cross-tenant data isolation
  // -----------------------------------------------------------------------
  describe("cross-tenant data isolation", () => {
    it("client A1 admin cannot see client A2 campaign participants", async () => {
      const { data, error } = await clientA1AdminDb
        .from("campaign_participants")
        .select("id")
        .eq("campaign_id", ids.campaignA2C1);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("client B1 admin cannot see client A1 campaign participants", async () => {
      const { data, error } = await clientB1AdminDb
        .from("campaign_participants")
        .select("id")
        .eq("campaign_id", ids.campaignA1C1);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("client A1 admin can see their own campaign participants", async () => {
      const { data, error } = await clientA1AdminDb
        .from("campaign_participants")
        .select("id")
        .eq("campaign_id", ids.campaignA1C1);
      expect(error).toBeNull();
      const returnedIds = (data ?? []).map((r) => r.id);
      expect(returnedIds).toContain(ids.participantA1);
    });

    it("partner A admin cannot see partner B client memberships", async () => {
      const { data, error } = await partnerAAdminDb
        .from("client_memberships")
        .select("id")
        .eq("client_id", ids.clientB1);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("client A1 admin cannot read client B1 memberships", async () => {
      const { data, error } = await clientA1AdminDb
        .from("client_memberships")
        .select("id")
        .eq("client_id", ids.clientB1);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });
  });
});
