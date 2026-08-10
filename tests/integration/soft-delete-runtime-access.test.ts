/**
 * Soft-delete enforcement (audit H5/H7).
 *
 * Pins two contracts:
 * 1. Runtime access: a soft-deleted participant's access token stops
 *    validating, and a soft-deleted campaign assessment stops resolving —
 *    via requireParticipantRuntimeAccess / …CampaignAssessmentAccess, the
 *    same helpers the assess runtime uses.
 * 2. Reactivation: after soft-deleting a campaign assessment or
 *    deactivating a client assessment assignment, the same pair can be
 *    added again (partial unique indexes over live rows only), while a
 *    duplicate LIVE row is still rejected.
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ParticipantRuntimeAccessError,
  requireParticipantRuntimeAccess,
  requireParticipantRuntimeCampaignAssessmentAccess,
} from "@/lib/auth/participant-runtime";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";

const ts = Date.now();
const testSlug = (label: string) => `soft-del-${label}-${ts}`;

describe.skipIf(!canRun)("soft-delete runtime access + reactivation", () => {
  const adminDb = createAdminClient();

  const token = randomBytes(32).toString("hex");
  const ids = {
    partner: "",
    client: "",
    assessment: "",
    campaign: "",
    participant: "",
    campaignAssessment: "",
  };

  beforeAll(async () => {
    if (!canRun) return;

    const { data: partner } = await adminDb
      .from("partners")
      .insert({ name: `SoftDel Partner ${ts}`, slug: testSlug("partner") })
      .select("id")
      .single();
    ids.partner = partner!.id;

    const { data: client } = await adminDb
      .from("clients")
      .insert({
        name: `SoftDel Client ${ts}`,
        slug: testSlug("client"),
        partner_id: ids.partner,
      })
      .select("id")
      .single();
    ids.client = client!.id;

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

    const { data: campaign } = await adminDb
      .from("campaigns")
      .insert({
        title: `SoftDel Campaign ${ts}`,
        slug: testSlug("campaign"),
        client_id: ids.client,
        partner_id: ids.partner,
        status: "active",
      })
      .select("id")
      .single();
    ids.campaign = campaign!.id;

    const { data: ca } = await adminDb
      .from("campaign_assessments")
      .insert({
        campaign_id: ids.campaign,
        assessment_id: ids.assessment,
        display_order: 0,
      })
      .select("id")
      .single();
    ids.campaignAssessment = ca!.id;

    const { data: participant } = await adminDb
      .from("campaign_participants")
      .insert({
        campaign_id: ids.campaign,
        email: `soft-del-${ts}@test.local`,
        first_name: "Test",
        last_name: "SoftDelete",
        status: "invited",
        access_token: token,
      })
      .select("id")
      .single();
    ids.participant = participant!.id;
  }, 90_000);

  afterAll(async () => {
    if (!canRun) return;
    await adminDb.from("campaign_participants").delete().eq("id", ids.participant);
    await adminDb
      .from("campaign_assessments")
      .delete()
      .eq("campaign_id", ids.campaign);
    await adminDb
      .from("client_assessment_assignments")
      .delete()
      .eq("client_id", ids.client);
    await adminDb.from("campaigns").delete().eq("id", ids.campaign);
    await adminDb.from("assessments").delete().eq("id", ids.assessment);
    await adminDb.from("clients").delete().eq("id", ids.client);
    await adminDb.from("partners").delete().eq("id", ids.partner);
  }, 60_000);

  it("a live participant's token validates and the assessment resolves", async () => {
    const access = await requireParticipantRuntimeAccess(token);
    expect(access.participantId).toBe(ids.participant);

    await expect(
      requireParticipantRuntimeCampaignAssessmentAccess({
        token,
        participantId: ids.participant,
        campaignId: ids.campaign,
        assessmentId: ids.assessment,
      }),
    ).resolves.toBeTruthy();
  });

  it("a soft-deleted campaign assessment stops resolving at runtime", async () => {
    await adminDb
      .from("campaign_assessments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", ids.campaignAssessment);

    await expect(
      requireParticipantRuntimeCampaignAssessmentAccess({
        token,
        participantId: ids.participant,
        campaignId: ids.campaign,
        assessmentId: ids.assessment,
      }),
    ).rejects.toThrow(ParticipantRuntimeAccessError);
  });

  it("the same assessment can be re-added after soft-deletion, but not twice", async () => {
    // Re-add succeeds — the partial unique index ignores the soft-deleted row.
    const { data: readded, error: readdError } = await adminDb
      .from("campaign_assessments")
      .insert({
        campaign_id: ids.campaign,
        assessment_id: ids.assessment,
        display_order: 1,
      })
      .select("id")
      .single();
    expect(readdError).toBeNull();
    expect(readded?.id).toBeTruthy();

    // A duplicate LIVE row is still rejected.
    const { error: dupError } = await adminDb.from("campaign_assessments").insert({
      campaign_id: ids.campaign,
      assessment_id: ids.assessment,
      display_order: 2,
    });
    expect(dupError?.code).toBe("23505");
  });

  it("a client entitlement can be reassigned after deactivation, but not while active", async () => {
    const { error: firstInsert } = await adminDb
      .from("client_assessment_assignments")
      .insert({
        client_id: ids.client,
        assessment_id: ids.assessment,
        is_active: true,
      });
    expect(firstInsert).toBeNull();

    // Duplicate ACTIVE assignment rejected.
    const { error: dupActive } = await adminDb
      .from("client_assessment_assignments")
      .insert({
        client_id: ids.client,
        assessment_id: ids.assessment,
        is_active: true,
      });
    expect(dupActive?.code).toBe("23505");

    // Deactivate (the "remove entitlement" path), then reassign — succeeds.
    await adminDb
      .from("client_assessment_assignments")
      .update({ is_active: false })
      .eq("client_id", ids.client)
      .eq("assessment_id", ids.assessment);

    const { error: reassign } = await adminDb
      .from("client_assessment_assignments")
      .insert({
        client_id: ids.client,
        assessment_id: ids.assessment,
        is_active: true,
      });
    expect(reassign).toBeNull();
  });

  it("a soft-deleted participant's token stops validating", async () => {
    await adminDb
      .from("campaign_participants")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", ids.participant);

    await expect(requireParticipantRuntimeAccess(token)).rejects.toThrow(
      ParticipantRuntimeAccessError,
    );
  });
});
