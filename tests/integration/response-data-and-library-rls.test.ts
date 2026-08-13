/**
 * Integration tests for RLS tenant isolation on response-data family tables.
 *
 * This extends tenant-isolation.test.ts to cover the highest-value uncovered
 * tables per audit finding T2 (corrected 2026-06-11):
 *
 *   Priority 1: participant_sessions, participant_responses, participant_scores
 *               (assessment response data — the crown jewels)
 *   Priority 2: report_snapshots (report content + PII)
 *   Priority 3: items, item_options, item_parameters, item_selection_rules (IP)
 *               NOTE: items, item_options, item_parameters have intentionally-wide
 *               SELECT policies (any authenticated user). This test documents that
 *               current behavior.
 *   Priority 4: integration_credentials
 *   Priority 5: user_invites
 *
 * Fixture builds on the fixture hierarchy in tenant-isolation.test.ts:
 *   Partner A
 *     ├── Client A1  →  Campaign A1-C1  (+ participant + session + responses + scores)
 *     └── Client A2
 *   Partner B
 *     └── Client B1  →  Campaign B1-C1  (+ participant + session + responses + scores)
 *
 * Test matrix:
 *   - SELECT isolation: cross-tenant reads return 0 rows / errors
 *   - UPDATE/DELETE: cross-tenant writes affect 0 rows / are denied
 *   - INSERT: where schema supports it, cross-tenant inserts are denied
 *   - Library tables (items, item_*): note intentionally-wide SELECT policies
 *
 * Requires a running Supabase instance (local or remote) with env vars:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  canRun,
  createAdminClient,
  createTestUser,
} from "./_helpers/rls-fixture";

const ts = Date.now();

function testEmail(label: string) {
  return `rls-response-data-${label}-${ts}@test.local`;
}

function testSlug(label: string) {
  return `rls-resp-${label}-${ts}`;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe.skipIf(!canRun)(
  "tenant isolation: response-data family (RLS)",
  () => {
    const adminDb = createAdminClient();

    let platformAdminDb: SupabaseClient;
    let partnerAAdminDb: SupabaseClient;
    let clientA1AdminDb: SupabaseClient;
    let clientB1AdminDb: SupabaseClient;

    const ids = {
      partnerA: "",
      partnerB: "",
      clientA1: "",
      clientA2: "",
      clientB1: "",
      campaignA1C1: "",
      campaignB1C1: "",
      assessmentA1: "",
      assessmentB1: "",
      participantA1: "",
      participantB1: "",
      sessionA1: "",
      sessionB1: "",
      responseA1: "",
      responseB1: "",
      scoreA1: "",
      scoreB1: "",
      reportSnapshotA1: "",
      reportSnapshotB1: "",
      itemA1: "",
      itemB1: "",
      itemOptionA1: "",
      itemOptionB1: "",
      itemParameterA1: "",
      itemParameterB1: "",
      itemSelectionRule: "",
      integrationConnectionId: "",
      credentialA1: "",
      credentialB1: "",
      reportTemplate: "",
      reportTemplateB: "",
      factorA1: "",
      factorB1: "",
    };

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

      // --- Participants ---
      const { data: partA1 } = await adminDb
        .from("campaign_participants")
        .insert({
          campaign_id: ids.campaignA1C1,
          email: testEmail("participant-a1"),
          first_name: "Alice",
          last_name: "Anderson",
        })
        .select("id")
        .single();
      ids.participantA1 = partA1!.id;

      const { data: partB1 } = await adminDb
        .from("campaign_participants")
        .insert({
          campaign_id: ids.campaignB1C1,
          email: testEmail("participant-b1"),
          first_name: "Bob",
          last_name: "Brown",
        })
        .select("id")
        .single();
      ids.participantB1 = partB1!.id;

      // --- Response Formats (library) ---
      const { data: rfLikert } = await adminDb
        .from("response_formats")
        .insert({
          name: `Likert ${ts}`,
          type: "likert",
          config: { scale: 5 },
        })
        .select("id")
        .single();
      const rfId = rfLikert!.id;

      // --- Factors (for scores) ---
      const { data: factorA1Res } = await adminDb
        .from("factors")
        .insert({
          name: `Factor A1 ${ts}`,
          slug: testSlug("factor-a1"),
          partner_id: ids.partnerA,
        })
        .select("id")
        .single();
      ids.factorA1 = factorA1Res!.id;

      const { data: factorB1Res } = await adminDb
        .from("factors")
        .insert({
          name: `Factor B1 ${ts}`,
          slug: testSlug("factor-b1"),
          partner_id: ids.partnerB,
        })
        .select("id")
        .single();
      ids.factorB1 = factorB1Res!.id;

      // --- Items (assessment questions - library, intentionally open SELECT) ---
      const { data: itemA1 } = await adminDb
        .from("items")
        .insert({
          response_format_id: rfId,
          stem: "Test item A1",
          purpose: "impression_management",
        })
        .select("id")
        .single();
      ids.itemA1 = itemA1!.id;

      const { data: itemB1 } = await adminDb
        .from("items")
        .insert({
          response_format_id: rfId,
          stem: "Test item B1",
          purpose: "impression_management",
        })
        .select("id")
        .single();
      ids.itemB1 = itemB1!.id;

      // --- Item Options (child of items) ---
      const { data: optA1 } = await adminDb
        .from("item_options")
        .insert({
          item_id: ids.itemA1,
          label: "Strongly Agree",
          value: 5,
          display_order: 0,
        })
        .select("id")
        .single();
      ids.itemOptionA1 = optA1!.id;

      const { data: optB1 } = await adminDb
        .from("item_options")
        .insert({
          item_id: ids.itemB1,
          label: "Strongly Agree",
          value: 5,
          display_order: 0,
        })
        .select("id")
        .single();
      ids.itemOptionB1 = optB1!.id;

      // --- Item Parameters (IRT calibration, library) ---
      const { data: paramA1 } = await adminDb
        .from("item_parameters")
        .insert({
          item_id: ids.itemA1,
          discrimination: 1.5,
          difficulty: 0.5,
          model_type: "2PL",
        })
        .select("id")
        .single();
      ids.itemParameterA1 = paramA1!.id;

      const { data: paramB1 } = await adminDb
        .from("item_parameters")
        .insert({
          item_id: ids.itemB1,
          discrimination: 1.2,
          difficulty: 0.3,
          model_type: "2PL",
        })
        .select("id")
        .single();
      ids.itemParameterB1 = paramB1!.id;

      // --- Item Selection Rules (platform-wide, no tenant scoping) ---
      const { data: selRule } = await adminDb
        .from("item_selection_rules")
        .insert({
          min_constructs: 5,
          max_constructs: 10,
          items_per_construct: 3,
        })
        .select("id")
        .single();
      ids.itemSelectionRule = selRule!.id;

      // --- Assessments ---
      const { data: assA1 } = await adminDb
        .from("assessments")
        .insert({
          title: `Assessment A1 ${ts}`,
          slug: testSlug("ass-a1"),
          client_id: ids.clientA1,
          partner_id: ids.partnerA,
          status: "active",
        })
        .select("id")
        .single();
      ids.assessmentA1 = assA1!.id;

      const { data: assB1 } = await adminDb
        .from("assessments")
        .insert({
          title: `Assessment B1 ${ts}`,
          slug: testSlug("ass-b1"),
          client_id: ids.clientB1,
          partner_id: ids.partnerB,
          status: "active",
        })
        .select("id")
        .single();
      ids.assessmentB1 = assB1!.id;

      // --- Participant Sessions ---
      const { data: sessA1 } = await adminDb
        .from("participant_sessions")
        .insert({
          assessment_id: ids.assessmentA1,
          campaign_id: ids.campaignA1C1,
          campaign_participant_id: ids.participantA1,
          client_id: ids.clientA1,
          status: "completed",
        })
        .select("id")
        .single();
      ids.sessionA1 = sessA1!.id;

      const { data: sessB1 } = await adminDb
        .from("participant_sessions")
        .insert({
          assessment_id: ids.assessmentB1,
          campaign_id: ids.campaignB1C1,
          campaign_participant_id: ids.participantB1,
          client_id: ids.clientB1,
          status: "completed",
        })
        .select("id")
        .single();
      ids.sessionB1 = sessB1!.id;

      // --- Participant Responses (no section_id for simplicity) ---
      const { data: respA1 } = await adminDb
        .from("participant_responses")
        .insert({
          session_id: ids.sessionA1,
          item_id: ids.itemA1,
          response_value: 5,
          response_data: { choice: "strongly_agree" },
          response_time_ms: 5000,
        })
        .select("id")
        .single();
      ids.responseA1 = respA1!.id;

      const { data: respB1 } = await adminDb
        .from("participant_responses")
        .insert({
          session_id: ids.sessionB1,
          item_id: ids.itemB1,
          response_value: 4,
          response_data: { choice: "agree" },
          response_time_ms: 4000,
        })
        .select("id")
        .single();
      ids.responseB1 = respB1!.id;

      // --- Participant Scores ---
      const { data: scoreA1 } = await adminDb
        .from("participant_scores")
        .insert({
          session_id: ids.sessionA1,
          factor_id: ids.factorA1,
          raw_score: 85,
          scaled_score: 92,
          percentile: 75,
          scoring_method: "irt",
        })
        .select("id")
        .single();
      ids.scoreA1 = scoreA1!.id;

      const { data: scoreB1 } = await adminDb
        .from("participant_scores")
        .insert({
          session_id: ids.sessionB1,
          factor_id: ids.factorB1,
          raw_score: 78,
          scaled_score: 85,
          percentile: 62,
          scoring_method: "irt",
        })
        .select("id")
        .single();
      ids.scoreB1 = scoreB1!.id;

      // --- Report Templates (partner-scoped, not client-scoped) ---
      const { data: repTempARes } = await adminDb
        .from("report_templates")
        .insert({
          name: `Report Template A ${ts}`,
          partner_id: ids.partnerA,
        })
        .select("id")
        .single();
      ids.reportTemplate = repTempARes!.id;

      const { data: repTempBRes } = await adminDb
        .from("report_templates")
        .insert({
          name: `Report Template B ${ts}`,
          partner_id: ids.partnerB,
        })
        .select("id")
        .single();
      ids.reportTemplateB = repTempBRes!.id;

      // --- Report Snapshots ---
      const { data: snapA1 } = await adminDb
        .from("report_snapshots")
        .insert({
          template_id: ids.reportTemplate,
          participant_session_id: ids.sessionA1,
          campaign_id: ids.campaignA1C1,
          audience_type: "participant",
          status: "ready",
          narrative_mode: "derived",
        })
        .select("id")
        .single();
      ids.reportSnapshotA1 = snapA1!.id;

      const { data: snapB1 } = await adminDb
        .from("report_snapshots")
        .insert({
          template_id: ids.reportTemplateB,
          participant_session_id: ids.sessionB1,
          campaign_id: ids.campaignB1C1,
          audience_type: "participant",
          status: "ready",
          narrative_mode: "derived",
        })
        .select("id")
        .single();
      ids.reportSnapshotB1 = snapB1!.id;

      // --- Integration Connections (client-scoped) ---
      // Create one for client A1
      const { data: intConnA1 } = await adminDb
        .from("integration_connections")
        .insert({
          client_id: ids.clientA1,
          provider_slug: "webhook",
          display_name: `Test Connection A1 ${ts}`,
        })
        .select("id")
        .single();
      ids.integrationConnectionId = intConnA1!.id;

      // Create one for client B1
      const { data: intConnB1 } = await adminDb
        .from("integration_connections")
        .insert({
          client_id: ids.clientB1,
          provider_slug: "webhook",
          display_name: `Test Connection B1 ${ts}`,
        })
        .select("id")
        .single();
      const integrationConnectionIdB1 = intConnB1!.id;

      // --- Integration Credentials ---
      const { data: credA1 } = await adminDb
        .from("integration_credentials")
        .insert({
          integration_connection_id: ids.integrationConnectionId,
          client_id: ids.clientA1,
          label: "Client A1 API Key",
          key_prefix: `cred-a1-${ts}`,
          secret_hash: "hash_of_secret_a1",
          scopes: ["read", "write"],
        })
        .select("id")
        .single();
      ids.credentialA1 = credA1!.id;

      const { data: credB1 } = await adminDb
        .from("integration_credentials")
        .insert({
          integration_connection_id: integrationConnectionIdB1,
          client_id: ids.clientB1,
          label: "Client B1 API Key",
          key_prefix: `cred-b1-${ts}`,
          secret_hash: "hash_of_secret_b1",
          scopes: ["read"],
        })
        .select("id")
        .single();
      ids.credentialB1 = credB1!.id;

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

      await adminDb.from("client_memberships").insert({
        profile_id: clientB1Admin.userId,
        client_id: ids.clientB1,
        role: "admin",
      });
    }, 90_000);

    // -----------------------------------------------------------------------
    // Teardown
    // -----------------------------------------------------------------------
    afterAll(async () => {
      if (!canRun) return;

      // Delete in dependency order
      await adminDb
        .from("integration_credentials")
        .delete()
        .in("id", [ids.credentialA1, ids.credentialB1]);

      await adminDb
        .from("integration_connections")
        .delete()
        .in("client_id", [ids.clientA1, ids.clientB1]);

      await adminDb
        .from("report_snapshots")
        .delete()
        .in("id", [ids.reportSnapshotA1, ids.reportSnapshotB1]);

      await adminDb
        .from("report_templates")
        .delete()
        .in("client_id", [ids.clientA1, ids.clientB1]);

      await adminDb
        .from("participant_scores")
        .delete()
        .in("id", [ids.scoreA1, ids.scoreB1]);

      await adminDb
        .from("participant_responses")
        .delete()
        .in("id", [ids.responseA1, ids.responseB1]);

      await adminDb
        .from("participant_sessions")
        .delete()
        .in("id", [ids.sessionA1, ids.sessionB1]);

      await adminDb
        .from("campaign_participants")
        .delete()
        .in("id", [ids.participantA1, ids.participantB1]);

      await adminDb
        .from("campaigns")
        .delete()
        .in("id", [ids.campaignA1C1, ids.campaignB1C1]);

      await adminDb
        .from("assessments")
        .delete()
        .in("id", [ids.assessmentA1, ids.assessmentB1]);

      await adminDb
        .from("item_parameters")
        .delete()
        .in("id", [ids.itemParameterA1, ids.itemParameterB1]);

      await adminDb
        .from("item_options")
        .delete()
        .in("id", [ids.itemOptionA1, ids.itemOptionB1]);

      await adminDb
        .from("items")
        .delete()
        .in("id", [ids.itemA1, ids.itemB1]);

      await adminDb
        .from("item_selection_rules")
        .delete()
        .eq("id", ids.itemSelectionRule);

      await adminDb
        .from("response_formats")
        .delete()
        .in("name", [`Likert ${ts}`]);

      await adminDb
        .from("factors")
        .delete()
        .in("id", [ids.factorA1, ids.factorB1]);

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

      for (const uid of authUserIds) {
        await adminDb.from("profiles").delete().eq("id", uid);
        await adminDb.auth.admin.deleteUser(uid);
      }
    }, 30_000);

    // -----------------------------------------------------------------------
    // Participant Sessions
    // -----------------------------------------------------------------------
    describe("participant_sessions isolation", () => {
      it("client A1 admin can read their own session", async () => {
        const { data, error } = await clientA1AdminDb
          .from("participant_sessions")
          .select("id")
          .eq("id", ids.sessionA1);
        expect(error).toBeNull();
        expect((data ?? []).map((r) => r.id)).toContain(ids.sessionA1);
      });

      it("client B1 admin cannot read client A1 session", async () => {
        const { data, error } = await clientB1AdminDb
          .from("participant_sessions")
          .select("id")
          .eq("id", ids.sessionA1);
        expect(error).toBeNull();
        expect(data ?? []).toHaveLength(0);
      });

      it("client B1 admin cannot update client A1 session", async () => {
        const { data } = await clientB1AdminDb
          .from("participant_sessions")
          .update({ status: "in_progress" })
          .eq("id", ids.sessionA1)
          .select("id");
        expect(data ?? []).toHaveLength(0);

        // Verify untouched
        const { data: verify } = await adminDb
          .from("participant_sessions")
          .select("status")
          .eq("id", ids.sessionA1)
          .single();
        expect(verify?.status).toBe("completed");
      });

      it("client B1 admin cannot delete client A1 session", async () => {
        const { data } = await clientB1AdminDb
          .from("participant_sessions")
          .delete()
          .eq("id", ids.sessionA1)
          .select("id");
        expect(data ?? []).toHaveLength(0);

        // Verify still exists
        const { data: verify } = await adminDb
          .from("participant_sessions")
          .select("id")
          .eq("id", ids.sessionA1);
        expect((verify ?? []).length).toBe(1);
      });
    });

    // -----------------------------------------------------------------------
    // Participant Responses
    // -----------------------------------------------------------------------
    describe("participant_responses isolation", () => {
      it("client A1 admin can read their own responses", async () => {
        const { data, error } = await clientA1AdminDb
          .from("participant_responses")
          .select("id")
          .eq("id", ids.responseA1);
        expect(error).toBeNull();
        expect((data ?? []).map((r) => r.id)).toContain(ids.responseA1);
      });

      it("client B1 admin cannot read client A1 responses", async () => {
        const { data, error } = await clientB1AdminDb
          .from("participant_responses")
          .select("id")
          .eq("id", ids.responseA1);
        expect(error).toBeNull();
        expect(data ?? []).toHaveLength(0);
      });

      it("client B1 admin cannot insert response into client A1 session", async () => {
        const { error } = await clientB1AdminDb
          .from("participant_responses")
          .insert({
            session_id: ids.sessionA1,
            item_id: ids.itemA1,
            response_value: 3,
            response_data: {},
          });
        // RLS WITH CHECK should reject
        expect(error).not.toBeNull();

        // Verify no row created
        const { data: leaked } = await adminDb
          .from("participant_responses")
          .select("id")
          .eq("session_id", ids.sessionA1);
        expect(leaked?.length).toBe(1); // Only the original one
      });

      it("client B1 admin cannot update client A1 response", async () => {
        const { data } = await clientB1AdminDb
          .from("participant_responses")
          .update({ response_value: 1 })
          .eq("id", ids.responseA1)
          .select("id");
        expect(data ?? []).toHaveLength(0);

        // Verify untouched
        const { data: verify } = await adminDb
          .from("participant_responses")
          .select("response_value")
          .eq("id", ids.responseA1)
          .single();
        expect(verify?.response_value).toBe(5);
      });

      it("client B1 admin cannot delete client A1 response", async () => {
        const { data } = await clientB1AdminDb
          .from("participant_responses")
          .delete()
          .eq("id", ids.responseA1)
          .select("id");
        expect(data ?? []).toHaveLength(0);

        // Verify still exists
        const { data: verify } = await adminDb
          .from("participant_responses")
          .select("id")
          .eq("id", ids.responseA1);
        expect((verify ?? []).length).toBe(1);
      });
    });

    // -----------------------------------------------------------------------
    // Participant Scores
    // -----------------------------------------------------------------------
    describe("participant_scores isolation", () => {
      it("client A1 admin can read their own scores", async () => {
        const { data, error } = await clientA1AdminDb
          .from("participant_scores")
          .select("id")
          .eq("id", ids.scoreA1);
        expect(error).toBeNull();
        expect((data ?? []).map((r) => r.id)).toContain(ids.scoreA1);
      });

      it("client B1 admin cannot read client A1 scores", async () => {
        const { data, error } = await clientB1AdminDb
          .from("participant_scores")
          .select("id")
          .eq("id", ids.scoreA1);
        expect(error).toBeNull();
        expect(data ?? []).toHaveLength(0);
      });

      it("client B1 admin cannot update client A1 score", async () => {
        const { data } = await clientB1AdminDb
          .from("participant_scores")
          .update({ scaled_score: 50 })
          .eq("id", ids.scoreA1)
          .select("id");
        expect(data ?? []).toHaveLength(0);

        // Verify untouched
        const { data: verify } = await adminDb
          .from("participant_scores")
          .select("scaled_score")
          .eq("id", ids.scoreA1)
          .single();
        expect(verify?.scaled_score).toBe(92);
      });

      it("client B1 admin cannot delete client A1 score", async () => {
        const { data } = await clientB1AdminDb
          .from("participant_scores")
          .delete()
          .eq("id", ids.scoreA1)
          .select("id");
        expect(data ?? []).toHaveLength(0);

        // Verify still exists
        const { data: verify } = await adminDb
          .from("participant_scores")
          .select("id")
          .eq("id", ids.scoreA1);
        expect((verify ?? []).length).toBe(1);
      });
    });

    // -----------------------------------------------------------------------
    // Report Snapshots
    // -----------------------------------------------------------------------
    describe("report_snapshots isolation", () => {
      it("client A1 admin cannot read unreleased report snapshot", async () => {
        const { data, error } = await clientA1AdminDb
          .from("report_snapshots")
          .select("id")
          .eq("id", ids.reportSnapshotA1);
        expect(error).toBeNull();
        expect(data ?? []).toHaveLength(0); // Not released, so no visibility
      });

      it("client B1 admin cannot read client A1 report snapshot (released or not)", async () => {
        const { data, error } = await clientB1AdminDb
          .from("report_snapshots")
          .select("id")
          .eq("id", ids.reportSnapshotA1);
        expect(error).toBeNull();
        expect(data ?? []).toHaveLength(0);
      });

      it("client B1 admin cannot update client A1 report snapshot", async () => {
        const { data } = await clientB1AdminDb
          .from("report_snapshots")
          .update({ status: "failed" })
          .eq("id", ids.reportSnapshotA1)
          .select("id");
        expect(data ?? []).toHaveLength(0);

        // Verify untouched
        const { data: verify } = await adminDb
          .from("report_snapshots")
          .select("status")
          .eq("id", ids.reportSnapshotA1)
          .single();
        expect(verify?.status).toBe("ready");
      });
    });

    // -----------------------------------------------------------------------
    // Items (library) — intentionally-wide SELECT
    // -----------------------------------------------------------------------
    describe("items (library table with wide SELECT)", () => {
      it("any authenticated user can read items (SELECT is open to any auth user)", async () => {
        // Items have intentionally wide SELECT: `(SELECT auth.uid() IS NOT NULL)` means
        // any authenticated user can read. This is correct for library items.
        const { data: dataA1 } = await clientA1AdminDb
          .from("items")
          .select("id")
          .eq("id", ids.itemA1);
        const { data: dataB1 } = await clientB1AdminDb
          .from("items")
          .select("id")
          .eq("id", ids.itemB1);

        expect((dataA1 ?? []).length).toBeGreaterThan(0);
        expect((dataB1 ?? []).length).toBeGreaterThan(0);
      });

      it("client B1 admin cannot update item (no UPDATE policy defined)", async () => {
        // Items have UPDATE policy: platform_admin only (implicitly denies via no explicit UPDATE policy).
        // But since items are library tables with SELECT open to all, they just filter rows.
        // In practice, non-platform-admins can't UPDATE items, but the RLS denies via USING clause filtering.
        const { data } = await clientB1AdminDb
          .from("items")
          .update({ stem: "Hacked" })
          .eq("id", ids.itemA1)
          .select("id");
        // Either error OR 0 rows affected is acceptable (depends on whether UPDATE policy exists).
        // In this case, items likely have implicit denial (no UPDATE USING), so 0 rows.
        expect((data ?? []).length).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    // Item Options (child of items, wide SELECT)
    // -----------------------------------------------------------------------
    describe("item_options isolation", () => {
      it("any authenticated user can read item options", async () => {
        const { data: dataA1 } = await clientA1AdminDb
          .from("item_options")
          .select("id")
          .eq("id", ids.itemOptionA1);
        const { data: dataB1 } = await clientB1AdminDb
          .from("item_options")
          .select("id")
          .eq("id", ids.itemOptionB1);

        expect((dataA1 ?? []).length).toBeGreaterThan(0);
        expect((dataB1 ?? []).length).toBeGreaterThan(0);
      });

      it("client B1 admin cannot update item option (platform_admin only)", async () => {
        const { data } = await clientB1AdminDb
          .from("item_options")
          .update({ label: "Hacked" })
          .eq("id", ids.itemOptionA1)
          .select("id");
        expect((data ?? []).length).toBe(0); // No UPDATE policy, filters to 0 rows
      });
    });

    // -----------------------------------------------------------------------
    // Item Parameters (IRT, wide SELECT)
    // -----------------------------------------------------------------------
    describe("item_parameters isolation", () => {
      // Changed by 20260813101000_item_key_privilege_hardening.sql: IRT item
      // parameters are commercial IP and a partial answer key (difficulty and
      // discrimination reveal a great deal about an item bank), so they are no
      // longer readable by every authenticated user. Before that migration
      // item_parameters carried TWO SELECT policies, _anon and _authenticated,
      // both effectively "any logged-in user"; both are replaced by a single
      // is_platform_admin() policy.
      it("platform admin can read item parameters", async () => {
        const { data: dataA1 } = await platformAdminDb
          .from("item_parameters")
          .select("id")
          .eq("id", ids.itemParameterA1);
        const { data: dataB1 } = await platformAdminDb
          .from("item_parameters")
          .select("id")
          .eq("id", ids.itemParameterB1);

        expect((dataA1 ?? []).length).toBeGreaterThan(0);
        expect((dataB1 ?? []).length).toBeGreaterThan(0);
      });

      it("non-platform-admin authenticated users cannot read item parameters", async () => {
        // Their own client's parameter row, not another tenant's — this is a
        // privilege check, not a tenancy check, so reading nothing here is the
        // point.
        const { data: dataA1 } = await clientA1AdminDb
          .from("item_parameters")
          .select("id")
          .eq("id", ids.itemParameterA1);
        const { data: dataB1 } = await clientB1AdminDb
          .from("item_parameters")
          .select("id")
          .eq("id", ids.itemParameterB1);

        expect((dataA1 ?? []).length).toBe(0);
        expect((dataB1 ?? []).length).toBe(0);
      });

      it("client B1 admin cannot update item parameter (platform_admin only)", async () => {
        const { data } = await clientB1AdminDb
          .from("item_parameters")
          .update({ difficulty: 0.9 })
          .eq("id", ids.itemParameterA1)
          .select("id");
        expect((data ?? []).length).toBe(0); // No UPDATE policy, filters to 0 rows
      });
    });

    // -----------------------------------------------------------------------
    // Item Selection Rules (platform-wide, no tenant scoping)
    // -----------------------------------------------------------------------
    describe("item_selection_rules (platform-wide, no tenant isolation)", () => {
      it("any authenticated user can read item selection rules", async () => {
        const { data: dataA1 } = await clientA1AdminDb
          .from("item_selection_rules")
          .select("id");
        const { data: dataB1 } = await clientB1AdminDb
          .from("item_selection_rules")
          .select("id");

        // Both should see the rule (no tenant scoping)
        const idsA1 = (dataA1 ?? []).map((r) => r.id);
        const idsB1 = (dataB1 ?? []).map((r) => r.id);
        expect(idsA1).toContain(ids.itemSelectionRule);
        expect(idsB1).toContain(ids.itemSelectionRule);
      });

      it("partner admin can update item selection rules", async () => {
        const { data, error } = await partnerAAdminDb
          .from("item_selection_rules")
          .update({ min_constructs: 6 })
          .eq("id", ids.itemSelectionRule)
          .select("id");
        expect(error).toBeNull();
        expect((data ?? []).length).toBeGreaterThan(0);

        // Revert
        await adminDb
          .from("item_selection_rules")
          .update({ min_constructs: 5 })
          .eq("id", ids.itemSelectionRule);
      });

      it("client admin cannot update item selection rules", async () => {
        const { data } = await clientA1AdminDb
          .from("item_selection_rules")
          .update({ min_constructs: 7 })
          .eq("id", ids.itemSelectionRule)
          .select("id");
        // UPDATE policy requires platform_admin or partner_admin; client admin filtered to 0 rows
        expect((data ?? []).length).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    // Integration Credentials (client-scoped)
    // -----------------------------------------------------------------------
    describe("integration_credentials isolation", () => {
      it("client A1 admin can read their own credentials", async () => {
        const { data, error } = await clientA1AdminDb
          .from("integration_credentials")
          .select("id")
          .eq("id", ids.credentialA1);
        expect(error).toBeNull();
        expect((data ?? []).map((r) => r.id)).toContain(ids.credentialA1);
      });

      it("client B1 admin cannot read client A1 credentials", async () => {
        const { data, error } = await clientB1AdminDb
          .from("integration_credentials")
          .select("id")
          .eq("id", ids.credentialA1);
        expect(error).toBeNull();
        expect(data ?? []).toHaveLength(0);
      });

      it("client B1 admin cannot update client A1 credentials", async () => {
        const { data } = await clientB1AdminDb
          .from("integration_credentials")
          .update({ label: "Hacked" })
          .eq("id", ids.credentialA1)
          .select("id");
        expect(data ?? []).toHaveLength(0);

        // Verify untouched
        const { data: verify } = await adminDb
          .from("integration_credentials")
          .select("label")
          .eq("id", ids.credentialA1)
          .single();
        expect(verify?.label).toBe("Client A1 API Key");
      });

      it("client B1 admin cannot delete client A1 credentials", async () => {
        const { data } = await clientB1AdminDb
          .from("integration_credentials")
          .delete()
          .eq("id", ids.credentialA1)
          .select("id");
        expect(data ?? []).toHaveLength(0);

        // Verify still exists
        const { data: verify } = await adminDb
          .from("integration_credentials")
          .select("id")
          .eq("id", ids.credentialA1);
        expect((verify ?? []).length).toBe(1);
      });
    });

    // -----------------------------------------------------------------------
    // User Invites (platform & tenant-scoped)
    // -----------------------------------------------------------------------
    describe("user_invites isolation", () => {
      let inviteA1Id: string;
      let inviteB1Id: string;

      beforeAll(async () => {
        // Create test invites scoped to each client
        const { data: invA1 } = await adminDb
          .from("user_invites")
          .insert({
            email: testEmail("invite-a1"),
            tenant_type: "client",
            tenant_id: ids.clientA1,
            role: "org_admin",
            invite_token_hash: `hash_invite_a1_${ts}`,
            invited_by_profile_id: authUserIds[0],
            expires_at: new Date(Date.now() + 86400000).toISOString(),
          })
          .select("id")
          .single();
        inviteA1Id = invA1!.id;

        const { data: invB1 } = await adminDb
          .from("user_invites")
          .insert({
            email: testEmail("invite-b1"),
            tenant_type: "client",
            tenant_id: ids.clientB1,
            role: "org_admin",
            invite_token_hash: `hash_invite_b1_${ts}`,
            invited_by_profile_id: authUserIds[0],
            expires_at: new Date(Date.now() + 86400000).toISOString(),
          })
          .select("id")
          .single();
        inviteB1Id = invB1!.id;
      });

      it("platform admin can delete any invite", async () => {
        // Delete via platform admin
        const { data, error } = await platformAdminDb
          .from("user_invites")
          .delete()
          .eq("id", inviteA1Id)
          .select("id");
        expect(error).toBeNull();
        expect((data ?? []).length).toBe(1);

        // Verify deleted
        const { data: verify } = await adminDb
          .from("user_invites")
          .select("id")
          .eq("id", inviteA1Id);
        expect(verify ?? []).toHaveLength(0);

        // Recreate for remaining tests
        const { data: newInv } = await adminDb
          .from("user_invites")
          .insert({
            email: testEmail("invite-a1-new"),
            tenant_type: "client",
            tenant_id: ids.clientA1,
            role: "org_admin",
            invite_token_hash: `hash_invite_a1_new_${ts}`,
            invited_by_profile_id: authUserIds[0],
            expires_at: new Date(Date.now() + 86400000).toISOString(),
          })
          .select("id")
          .single();
        inviteA1Id = newInv!.id;
      });

      afterAll(async () => {
        // Cleanup invites
        await adminDb
          .from("user_invites")
          .delete()
          .in("id", [inviteA1Id, inviteB1Id]);
      });
    });

    // -----------------------------------------------------------------------
    // Platform Admin Access (positive controls)
    // -----------------------------------------------------------------------
    describe("platform admin cross-tenant access", () => {
      it("platform admin can read all participant sessions", async () => {
        const { data, error } = await platformAdminDb
          .from("participant_sessions")
          .select("id")
          .in("id", [ids.sessionA1, ids.sessionB1]);
        expect(error).toBeNull();
        expect((data ?? []).map((r) => r.id).sort()).toEqual(
          [ids.sessionA1, ids.sessionB1].sort(),
        );
      });

      it("platform admin can read all responses", async () => {
        const { data, error } = await platformAdminDb
          .from("participant_responses")
          .select("id")
          .in("id", [ids.responseA1, ids.responseB1]);
        expect(error).toBeNull();
        expect((data ?? []).map((r) => r.id).sort()).toEqual(
          [ids.responseA1, ids.responseB1].sort(),
        );
      });

      it("platform admin can read all scores", async () => {
        const { data, error } = await platformAdminDb
          .from("participant_scores")
          .select("id")
          .in("id", [ids.scoreA1, ids.scoreB1]);
        expect(error).toBeNull();
        expect((data ?? []).map((r) => r.id).sort()).toEqual(
          [ids.scoreA1, ids.scoreB1].sort(),
        );
      });

      it("platform admin can read all credentials", async () => {
        const { data, error } = await platformAdminDb
          .from("integration_credentials")
          .select("id")
          .in("id", [ids.credentialA1, ids.credentialB1]);
        expect(error).toBeNull();
        expect((data ?? []).map((r) => r.id).sort()).toEqual(
          [ids.credentialA1, ids.credentialB1].sort(),
        );
      });
    });
  },
);
