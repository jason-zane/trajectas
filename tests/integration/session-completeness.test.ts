/**
 * getSessionCompleteness — backs the submitSession hard completeness gate
 * (an in-progress session may only be completed once every DELIVERED item
 * has a saved response).
 *
 * Pins: without a campaign factor selection, every assessment item counts;
 * responses to items outside the assessment don't inflate the count; a null
 * assessment id fails closed. With a factor selection
 * (campaign_assessment_factors), only items of the selected factors'
 * constructs plus always-delivered non-construct items count — mirroring the
 * runner's delivery pipeline, so a participant who answered everything they
 * were shown is complete.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSessionCompleteness } from "@/lib/dal/session-completeness";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";

const ts = Date.now();
const testSlug = (label: string) => `sess-compl-${label}-${ts}`;

describe.skipIf(!canRun)("getSessionCompleteness", () => {
  const adminDb = createAdminClient();

  const ids = {
    partner: "",
    client: "",
    responseFormat: "",
    assessment: "",
    section: "",
    factorA: "",
    factorB: "",
    constructA: "",
    constructB: "",
    itemA: "",
    itemB: "",
    itemChecky: "",
    itemOutside: "",
    campaign: "",
    campaignAssessment: "",
    participant: "",
    session: "",
  };

  beforeAll(async () => {
    if (!canRun) return;

    const { data: partner } = await adminDb
      .from("partners")
      .insert({ name: `Compl Partner ${ts}`, slug: testSlug("partner") })
      .select("id")
      .single();
    ids.partner = partner!.id;

    const { data: client } = await adminDb
      .from("clients")
      .insert({
        name: `Compl Client ${ts}`,
        slug: testSlug("client"),
        partner_id: ids.partner,
      })
      .select("id")
      .single();
    ids.client = client!.id;

    const { data: rf } = await adminDb
      .from("response_formats")
      .insert({ name: `Likert ${ts}`, type: "likert", config: { scale: 6 } })
      .select("id")
      .single();
    ids.responseFormat = rf!.id;

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

    const { data: section } = await adminDb
      .from("assessment_sections")
      .insert({
        assessment_id: ids.assessment,
        response_format_id: ids.responseFormat,
        title: "Section 1",
      })
      .select("id")
      .single();
    ids.section = section!.id;

    // Taxonomy: factor A → construct A, factor B → construct B; the
    // assessment carries both factors.
    async function makeFactor(label: string) {
      const { data } = await adminDb
        .from("factors")
        .insert({ name: `Factor ${label} ${ts}`, slug: testSlug(`f-${label}`), partner_id: ids.partner })
        .select("id")
        .single();
      return data!.id as string;
    }
    async function makeConstruct(label: string) {
      const { data } = await adminDb
        .from("constructs")
        .insert({ name: `Construct ${label} ${ts}`, slug: testSlug(`c-${label}`), partner_id: ids.partner })
        .select("id")
        .single();
      return data!.id as string;
    }
    ids.factorA = await makeFactor("A");
    ids.factorB = await makeFactor("B");
    ids.constructA = await makeConstruct("A");
    ids.constructB = await makeConstruct("B");
    await adminDb.from("factor_constructs").insert([
      { factor_id: ids.factorA, construct_id: ids.constructA },
      { factor_id: ids.factorB, construct_id: ids.constructB },
    ]);
    await adminDb.from("assessment_factors").insert([
      { assessment_id: ids.assessment, factor_id: ids.factorA },
      { assessment_id: ids.assessment, factor_id: ids.factorB },
    ]);

    async function makeItem(
      stem: string,
      opts: { constructId?: string; purpose?: string },
    ) {
      const { data: item } = await adminDb
        .from("items")
        .insert({
          response_format_id: ids.responseFormat,
          stem,
          purpose: opts.purpose ?? "construct",
          construct_id: opts.constructId ?? null,
        })
        .select("id")
        .single();
      return item!.id as string;
    }
    ids.itemA = await makeItem("Item A", { constructId: ids.constructA });
    ids.itemB = await makeItem("Item B", { constructId: ids.constructB });
    // Non-construct purpose — always delivered regardless of factor selection.
    ids.itemChecky = await makeItem("Attention item", {
      purpose: "impression_management",
    });
    // Belongs to no section of this assessment — a response to it must not count.
    ids.itemOutside = await makeItem("Item outside", {
      purpose: "impression_management",
    });

    await adminDb.from("assessment_section_items").insert([
      { section_id: ids.section, item_id: ids.itemA, display_order: 0 },
      { section_id: ids.section, item_id: ids.itemB, display_order: 1 },
      { section_id: ids.section, item_id: ids.itemChecky, display_order: 2 },
    ]);

    const { data: campaign } = await adminDb
      .from("campaigns")
      .insert({
        title: `Compl Campaign ${ts}`,
        slug: testSlug("campaign"),
        client_id: ids.client,
        partner_id: ids.partner,
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
        email: `sess-compl-${ts}@test.local`,
        first_name: "Test",
        last_name: "Completeness",
      })
      .select("id")
      .single();
    ids.participant = participant!.id;

    const { data: session } = await adminDb
      .from("participant_sessions")
      .insert({
        assessment_id: ids.assessment,
        campaign_id: ids.campaign,
        campaign_participant_id: ids.participant,
        client_id: ids.client,
        status: "in_progress",
      })
      .select("id")
      .single();
    ids.session = session!.id;
  }, 90_000);

  afterAll(async () => {
    if (!canRun) return;
    await adminDb.from("participant_responses").delete().eq("session_id", ids.session);
    await adminDb.from("participant_sessions").delete().eq("id", ids.session);
    await adminDb.from("campaign_participants").delete().eq("id", ids.participant);
    await adminDb
      .from("campaign_assessment_factors")
      .delete()
      .eq("campaign_assessment_id", ids.campaignAssessment);
    await adminDb
      .from("campaign_assessments")
      .delete()
      .eq("campaign_id", ids.campaign);
    await adminDb.from("campaigns").delete().eq("id", ids.campaign);
    await adminDb.from("assessment_section_items").delete().eq("section_id", ids.section);
    await adminDb.from("assessment_sections").delete().eq("id", ids.section);
    await adminDb
      .from("items")
      .delete()
      .in("id", [ids.itemA, ids.itemB, ids.itemChecky, ids.itemOutside]);
    await adminDb
      .from("assessment_factors")
      .delete()
      .eq("assessment_id", ids.assessment);
    await adminDb
      .from("factor_constructs")
      .delete()
      .in("factor_id", [ids.factorA, ids.factorB]);
    await adminDb
      .from("constructs")
      .delete()
      .in("id", [ids.constructA, ids.constructB]);
    await adminDb.from("factors").delete().in("id", [ids.factorA, ids.factorB]);
    await adminDb.from("assessments").delete().eq("id", ids.assessment);
    await adminDb.from("response_formats").delete().eq("id", ids.responseFormat);
    await adminDb.from("clients").delete().eq("id", ids.client);
    await adminDb.from("partners").delete().eq("id", ids.partner);
  }, 60_000);

  function check() {
    return getSessionCompleteness(adminDb, {
      sessionId: ids.session,
      assessmentId: ids.assessment,
      campaignId: ids.campaign,
    });
  }

  it("fails closed when the session has no assessment id", async () => {
    const result = await getSessionCompleteness(adminDb, {
      sessionId: ids.session,
      assessmentId: null,
      campaignId: ids.campaign,
    });
    expect(result).toHaveProperty("error");
  });

  it("counts every assessment item when the campaign has no factor selection", async () => {
    await adminDb.from("participant_responses").insert({
      session_id: ids.session,
      item_id: ids.itemA,
      response_value: 3,
    });

    const result = await check();
    expect(result).toEqual({ expected: 3, answered: 1 });
  });

  it("ignores responses to items that are not part of the assessment", async () => {
    await adminDb.from("participant_responses").insert({
      session_id: ids.session,
      item_id: ids.itemOutside,
      response_value: 5,
    });

    const result = await check();
    expect(result).toEqual({ expected: 3, answered: 1 });
  });

  it("counts only delivered items when the campaign selects a factor subset", async () => {
    // Select factor A only: delivered = itemA (construct A) + the
    // non-construct item. Item B is never shown, so it must not block
    // completion — this pins the runner-mirror behaviour.
    await adminDb.from("campaign_assessment_factors").insert({
      campaign_assessment_id: ids.campaignAssessment,
      factor_id: ids.factorA,
    });

    const partial = await check();
    expect(partial).toEqual({ expected: 2, answered: 1 });

    await adminDb.from("participant_responses").insert({
      session_id: ids.session,
      item_id: ids.itemChecky,
      response_value: 4,
    });

    const complete = await check();
    expect(complete).toEqual({ expected: 2, answered: 2 });
  });

  it("reports complete for the full set once the selection is cleared", async () => {
    await adminDb
      .from("campaign_assessment_factors")
      .delete()
      .eq("campaign_assessment_id", ids.campaignAssessment);

    await adminDb.from("participant_responses").insert({
      session_id: ids.session,
      item_id: ids.itemB,
      response_value: 4,
    });

    const result = await check();
    expect(result).toEqual({ expected: 3, answered: 3 });
  });
});
