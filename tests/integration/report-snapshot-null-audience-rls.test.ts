/**
 * RLS for NULL-audience report snapshots.
 *
 * Contract (see 20260810090000_report_snapshots_null_audience_campaign_scope.sql):
 * snapshots created since the report simplification carry audience_type NULL,
 * which means "campaign-scoped default". A member of the campaign's client
 * CAN read such a snapshot once released; they CANNOT read it while it is
 * unreleased, and CANNOT read it at all when the campaign is aggregate-only.
 * Members of an unrelated client see nothing. Platform admins see everything.
 *
 * This pins the fix for the regression where every post-simplification
 * snapshot was invisible to the client the report was generated for.
 * Mirrors the fixture/host-guard pattern of the other RLS suites.
 */

import { type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  canRun,
  createAdminClient,
  createTestUser,
} from "./_helpers/rls-fixture";

const ts = Date.now();
const testEmail = (label: string) => `rls-nullaud-${label}-${ts}@test.local`;
const testSlug = (label: string) => `rls-nullaud-${label}-${ts}`;

describe.skipIf(!canRun)("NULL-audience report snapshot RLS", () => {
  const adminDb = createAdminClient();

  let platformAdminDb: SupabaseClient;
  let clientAdminDb: SupabaseClient;
  let otherClientAdminDb: SupabaseClient;

  const ids = {
    partner: "",
    client: "",
    otherClient: "",
    assessment: "",
    template: "",
    // standard campaign
    stdCampaign: "",
    stdParticipant: "",
    stdSession: "",
    releasedSnapshot: "",
    unreleasedSnapshot: "",
    // aggregate-only campaign
    aggCampaign: "",
    aggParticipant: "",
    aggSession: "",
    aggSnapshot: "",
  };
  const authUserIds: string[] = [];

  beforeAll(async () => {
    if (!canRun) return;

    const { data: partner } = await adminDb
      .from("partners")
      .insert({ name: `NullAud Partner ${ts}`, slug: testSlug("partner") })
      .select("id")
      .single();
    ids.partner = partner!.id;

    const { data: client } = await adminDb
      .from("clients")
      .insert({
        name: `NullAud Client ${ts}`,
        slug: testSlug("client"),
        partner_id: ids.partner,
      })
      .select("id")
      .single();
    ids.client = client!.id;

    const { data: otherClient } = await adminDb
      .from("clients")
      .insert({
        name: `NullAud Other Client ${ts}`,
        slug: testSlug("other-client"),
        partner_id: ids.partner,
      })
      .select("id")
      .single();
    ids.otherClient = otherClient!.id;

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

    const { data: template } = await adminDb
      .from("report_templates")
      .insert({ name: `Template ${ts}`, partner_id: ids.partner })
      .select("id")
      .single();
    ids.template = template!.id;

    // Seed a campaign + completed session; snapshots are created per-test-need.
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

      return {
        campaign: campaign!.id,
        participant: participant!.id,
        session: session!.id,
      };
    }

    // audience_type deliberately omitted everywhere below — this suite pins
    // the behaviour of rows exactly as ensureReportSnapshotsForSession
    // creates them.
    async function seedSnapshot(
      campaignId: string,
      sessionId: string,
      released: boolean,
    ) {
      const { data: snapshot } = await adminDb
        .from("report_snapshots")
        .insert({
          template_id: ids.template,
          participant_session_id: sessionId,
          campaign_id: campaignId,
          status: released ? "released" : "ready",
          narrative_mode: "derived",
          released_at: released ? new Date().toISOString() : null,
        })
        .select("id, audience_type")
        .single();
      expect(snapshot!.audience_type).toBeNull();
      return snapshot!.id;
    }

    const std = await seedCampaign("standard", "std");
    ids.stdCampaign = std.campaign;
    ids.stdParticipant = std.participant;
    ids.stdSession = std.session;
    ids.releasedSnapshot = await seedSnapshot(std.campaign, std.session, true);

    // Second template so the (session, template) unique constraint allows a
    // second, unreleased snapshot on the same session.
    const { data: template2 } = await adminDb
      .from("report_templates")
      .insert({ name: `Template B ${ts}`, partner_id: ids.partner })
      .select("id")
      .single();
    const { data: unreleased } = await adminDb
      .from("report_snapshots")
      .insert({
        template_id: template2!.id,
        participant_session_id: std.session,
        campaign_id: std.campaign,
        status: "ready",
        narrative_mode: "derived",
        released_at: null,
      })
      .select("id")
      .single();
    ids.unreleasedSnapshot = unreleased!.id;

    const agg = await seedCampaign("aggregate_only", "agg");
    ids.aggCampaign = agg.campaign;
    ids.aggParticipant = agg.participant;
    ids.aggSession = agg.session;
    ids.aggSnapshot = await seedSnapshot(agg.campaign, agg.session, true);

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

    const otherClientAdmin = await createTestUser(adminDb, {
      email: testEmail("other-client-admin"),
      role: "org_admin",
      clientId: ids.otherClient,
    });
    otherClientAdminDb = otherClientAdmin.client;
    authUserIds.push(otherClientAdmin.userId);
    await adminDb.from("client_memberships").insert({
      profile_id: otherClientAdmin.userId,
      client_id: ids.otherClient,
      role: "admin",
    });
  }, 90_000);

  afterAll(async () => {
    if (!canRun) return;
    await adminDb
      .from("report_snapshots")
      .delete()
      .in("id", [ids.releasedSnapshot, ids.unreleasedSnapshot, ids.aggSnapshot]);
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
    await adminDb
      .from("client_memberships")
      .delete()
      .in("client_id", [ids.client, ids.otherClient]);
    await adminDb
      .from("clients")
      .delete()
      .in("id", [ids.client, ids.otherClient]);
    await adminDb.from("partners").delete().eq("id", ids.partner);
    for (const userId of authUserIds) {
      await adminDb.auth.admin.deleteUser(userId);
    }
  }, 60_000);

  describe("client admin (member of the campaign's client)", () => {
    it("reads a RELEASED NULL-audience snapshot", async () => {
      const { data } = await clientAdminDb
        .from("report_snapshots")
        .select("id")
        .eq("id", ids.releasedSnapshot);
      expect(data?.map((r) => r.id)).toContain(ids.releasedSnapshot);
    });

    it("CANNOT read an UNRELEASED NULL-audience snapshot", async () => {
      const { data } = await clientAdminDb
        .from("report_snapshots")
        .select("id")
        .eq("id", ids.unreleasedSnapshot);
      expect(data ?? []).toHaveLength(0);
    });

    it("CANNOT read a NULL-audience snapshot in an AGGREGATE_ONLY campaign", async () => {
      const { data } = await clientAdminDb
        .from("report_snapshots")
        .select("id")
        .eq("id", ids.aggSnapshot);
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe("unrelated client admin", () => {
    it("CANNOT read another client's released NULL-audience snapshot", async () => {
      const { data } = await otherClientAdminDb
        .from("report_snapshots")
        .select("id")
        .eq("id", ids.releasedSnapshot);
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe("platform admin", () => {
    it("reads all snapshots regardless of audience or release state", async () => {
      const { data } = await platformAdminDb
        .from("report_snapshots")
        .select("id")
        .in("id", [ids.releasedSnapshot, ids.unreleasedSnapshot, ids.aggSnapshot]);
      const idSet = new Set((data ?? []).map((r) => r.id));
      expect(idSet.has(ids.releasedSnapshot)).toBe(true);
      expect(idSet.has(ids.unreleasedSnapshot)).toBe(true);
      expect(idSet.has(ids.aggSnapshot)).toBe(true);
    });
  });
});
