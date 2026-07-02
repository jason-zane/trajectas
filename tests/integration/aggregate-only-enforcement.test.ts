/**
 * RLS enforcement for campaigns.confidentiality_mode = 'aggregate_only'.
 *
 * Contract (see src/lib/reports/confidentiality.ts and migration
 * 20260703120000_aggregate_only_enforcement.sql): when a campaign is
 * aggregate-only, a CLIENT admin must NOT be able to SELECT individual
 * results — participant_scores, participant_responses, or report_snapshots —
 * for that campaign's sessions. The same client admin CAN read those rows for
 * a STANDARD campaign in the same client. Platform admins retain access to
 * both (support / scoring QA).
 *
 * This proves the enforcement is server-side (at the row level), independent
 * of any UI gating. Mirrors the fixture/host-guard pattern of the other RLS
 * suites; the shared OTP fixture lives in _helpers/rls-fixture.ts.
 */

import { type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  canRun,
  createAdminClient,
  createTestUser,
} from "./_helpers/rls-fixture";

const ts = Date.now();
const testEmail = (label: string) => `rls-aggonly-${label}-${ts}@test.local`;
const testSlug = (label: string) => `rls-aggonly-${label}-${ts}`;

describe.skipIf(!canRun)("aggregate_only confidentiality enforcement", () => {
  const adminDb = createAdminClient();

  let platformAdminDb: SupabaseClient;
  let clientAdminDb: SupabaseClient;

  const ids = {
    partner: "",
    client: "",
    factor: "",
    responseFormat: "",
    item: "",
    assessment: "",
    // standard campaign
    stdCampaign: "",
    stdParticipant: "",
    stdSession: "",
    stdScore: "",
    stdResponse: "",
    stdSnapshot: "",
    // aggregate-only campaign
    aggCampaign: "",
    aggParticipant: "",
    aggSession: "",
    aggScore: "",
    aggResponse: "",
    aggSnapshot: "",
  };
  const authUserIds: string[] = [];

  beforeAll(async () => {
    if (!canRun) return;

    // --- Tenant ---
    const { data: partner } = await adminDb
      .from("partners")
      .insert({ name: `AggOnly Partner ${ts}`, slug: testSlug("partner") })
      .select("id")
      .single();
    ids.partner = partner!.id;

    const { data: client } = await adminDb
      .from("clients")
      .insert({
        name: `AggOnly Client ${ts}`,
        slug: testSlug("client"),
        partner_id: ids.partner,
      })
      .select("id")
      .single();
    ids.client = client!.id;

    // --- Library rows shared by both campaigns ---
    const { data: rf } = await adminDb
      .from("response_formats")
      .insert({ name: `Likert ${ts}`, type: "likert", config: { scale: 5 } })
      .select("id")
      .single();
    ids.responseFormat = rf!.id;

    const { data: factor } = await adminDb
      .from("factors")
      .insert({
        name: `Factor ${ts}`,
        slug: testSlug("factor"),
        partner_id: ids.partner,
      })
      .select("id")
      .single();
    ids.factor = factor!.id;

    const { data: item } = await adminDb
      .from("items")
      .insert({
        response_format_id: ids.responseFormat,
        stem: "Test item",
        purpose: "impression_management",
      })
      .select("id")
      .single();
    ids.item = item!.id;

    const { data: assessment } = await adminDb
      .from("assessments")
      .insert({
        title: `Assessment ${ts}`,
        slug: testSlug("assessment"),
        client_id: ids.client,
        partner_id: ids.partner,
        status: "active",
      })
      .select("id")
      .single();
    ids.assessment = assessment!.id;

    // --- Report template (partner-scoped) ---
    const { data: template } = await adminDb
      .from("report_templates")
      .insert({ name: `Template ${ts}`, partner_id: ids.partner })
      .select("id")
      .single();
    const templateId = template!.id;

    // Helper: build a campaign + participant + completed session + score +
    // response + released hr_manager snapshot. Returns the created ids.
    async function seedCampaign(
      mode: "standard" | "aggregate_only",
      label: string,
    ) {
      const { data: campaign } = await adminDb
        .from("campaigns")
        .insert({
          title: `${label} Campaign ${ts}`,
          slug: testSlug(label),
          client_id: ids.client,
          partner_id: ids.partner,
          confidentiality_mode: mode,
        })
        .select("id")
        .single();

      const { data: participant } = await adminDb
        .from("campaign_participants")
        .insert({
          campaign_id: campaign!.id,
          email: testEmail(`${label}-p`),
          first_name: "Test",
          last_name: label,
        })
        .select("id")
        .single();

      const { data: session } = await adminDb
        .from("participant_sessions")
        .insert({
          assessment_id: ids.assessment,
          campaign_id: campaign!.id,
          campaign_participant_id: participant!.id,
          client_id: ids.client,
          status: "completed",
        })
        .select("id")
        .single();

      const { data: score } = await adminDb
        .from("participant_scores")
        .insert({
          session_id: session!.id,
          factor_id: ids.factor,
          raw_score: 80,
          scaled_score: 90,
          percentile: 70,
          scoring_method: "irt",
        })
        .select("id")
        .single();

      const { data: response } = await adminDb
        .from("participant_responses")
        .insert({
          session_id: session!.id,
          item_id: ids.item,
          response_value: 5,
          response_data: { choice: "strongly_agree" },
          response_time_ms: 4000,
        })
        .select("id")
        .single();

      // hr_manager audience, released — the arm a client admin would read.
      const { data: snapshot } = await adminDb
        .from("report_snapshots")
        .insert({
          template_id: templateId,
          participant_session_id: session!.id,
          campaign_id: campaign!.id,
          audience_type: "hr_manager",
          status: "released",
          narrative_mode: "derived",
          released_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      return {
        campaign: campaign!.id,
        participant: participant!.id,
        session: session!.id,
        score: score!.id,
        response: response!.id,
        snapshot: snapshot!.id,
      };
    }

    const std = await seedCampaign("standard", "std");
    ids.stdCampaign = std.campaign;
    ids.stdParticipant = std.participant;
    ids.stdSession = std.session;
    ids.stdScore = std.score;
    ids.stdResponse = std.response;
    ids.stdSnapshot = std.snapshot;

    const agg = await seedCampaign("aggregate_only", "agg");
    ids.aggCampaign = agg.campaign;
    ids.aggParticipant = agg.participant;
    ids.aggSession = agg.session;
    ids.aggScore = agg.score;
    ids.aggResponse = agg.response;
    ids.aggSnapshot = agg.snapshot;

    // --- Users ---
    const platformAdmin = await createTestUser(adminDb, {
      email: testEmail("platform-admin"),
      role: "platform_admin",
    });
    platformAdminDb = platformAdmin.client;
    authUserIds.push(platformAdmin.userId);

    const clientAdmin = await createTestUser(adminDb, {
      email: testEmail("client-admin"),
      role: "org_admin",
      clientId: ids.client,
    });
    clientAdminDb = clientAdmin.client;
    authUserIds.push(clientAdmin.userId);

    await adminDb.from("client_memberships").insert({
      profile_id: clientAdmin.userId,
      client_id: ids.client,
      role: "admin",
    });
  }, 90_000);

  afterAll(async () => {
    if (!canRun) return;
    await adminDb
      .from("report_snapshots")
      .delete()
      .in("id", [ids.stdSnapshot, ids.aggSnapshot]);
    await adminDb
      .from("participant_scores")
      .delete()
      .in("id", [ids.stdScore, ids.aggScore]);
    await adminDb
      .from("participant_responses")
      .delete()
      .in("id", [ids.stdResponse, ids.aggResponse]);
    await adminDb
      .from("participant_sessions")
      .delete()
      .in("id", [ids.stdSession, ids.aggSession]);
    await adminDb
      .from("campaign_participants")
      .delete()
      .in("id", [ids.stdParticipant, ids.aggParticipant]);
    await adminDb.from("report_templates").delete().eq("partner_id", ids.partner);
    await adminDb
      .from("campaigns")
      .delete()
      .in("id", [ids.stdCampaign, ids.aggCampaign]);
    await adminDb.from("assessments").delete().eq("id", ids.assessment);
    await adminDb.from("items").delete().eq("id", ids.item);
    await adminDb.from("factors").delete().eq("id", ids.factor);
    await adminDb.from("response_formats").delete().eq("id", ids.responseFormat);
    await adminDb.from("client_memberships").delete().eq("client_id", ids.client);
    await adminDb.from("clients").delete().eq("id", ids.client);
    await adminDb.from("partners").delete().eq("id", ids.partner);
    for (const userId of authUserIds) {
      await adminDb.auth.admin.deleteUser(userId);
    }
  }, 60_000);

  // -------------------------------------------------------------------------
  // Client admin: standard campaign is readable; aggregate-only is not.
  // -------------------------------------------------------------------------

  describe("client admin", () => {
    it("reads participant_scores for a STANDARD campaign", async () => {
      const { data } = await clientAdminDb
        .from("participant_scores")
        .select("id")
        .eq("session_id", ids.stdSession);
      expect(data?.map((r) => r.id)).toContain(ids.stdScore);
    });

    it("CANNOT read participant_scores for an AGGREGATE_ONLY campaign", async () => {
      const { data } = await clientAdminDb
        .from("participant_scores")
        .select("id")
        .eq("session_id", ids.aggSession);
      expect(data ?? []).toHaveLength(0);
    });

    it("reads participant_responses for a STANDARD campaign", async () => {
      const { data } = await clientAdminDb
        .from("participant_responses")
        .select("id")
        .eq("session_id", ids.stdSession);
      expect(data?.map((r) => r.id)).toContain(ids.stdResponse);
    });

    it("CANNOT read participant_responses for an AGGREGATE_ONLY campaign", async () => {
      const { data } = await clientAdminDb
        .from("participant_responses")
        .select("id")
        .eq("session_id", ids.aggSession);
      expect(data ?? []).toHaveLength(0);
    });

    it("reads the released hr_manager snapshot for a STANDARD campaign", async () => {
      const { data } = await clientAdminDb
        .from("report_snapshots")
        .select("id")
        .eq("id", ids.stdSnapshot);
      expect(data?.map((r) => r.id)).toContain(ids.stdSnapshot);
    });

    it("CANNOT read the hr_manager snapshot for an AGGREGATE_ONLY campaign", async () => {
      const { data } = await clientAdminDb
        .from("report_snapshots")
        .select("id")
        .eq("id", ids.aggSnapshot);
      expect(data ?? []).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Platform admin: both readable (support / scoring QA retains access).
  // -------------------------------------------------------------------------

  describe("platform admin", () => {
    it("reads participant_scores for BOTH campaigns", async () => {
      const { data } = await platformAdminDb
        .from("participant_scores")
        .select("id")
        .in("session_id", [ids.stdSession, ids.aggSession]);
      const idSet = new Set((data ?? []).map((r) => r.id));
      expect(idSet.has(ids.stdScore)).toBe(true);
      expect(idSet.has(ids.aggScore)).toBe(true);
    });

    it("reads report_snapshots for BOTH campaigns", async () => {
      const { data } = await platformAdminDb
        .from("report_snapshots")
        .select("id")
        .in("id", [ids.stdSnapshot, ids.aggSnapshot]);
      const idSet = new Set((data ?? []).map((r) => r.id));
      expect(idSet.has(ids.stdSnapshot)).toBe(true);
      expect(idSet.has(ids.aggSnapshot)).toBe(true);
    });
  });
});
