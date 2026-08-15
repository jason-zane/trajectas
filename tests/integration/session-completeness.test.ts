/**
 * getSessionCompleteness — backs the submitSession hard completeness gate
 * (an in-progress session may only be completed once every DELIVERED item
 * has a saved response).
 *
 * Pins: without a campaign factor selection, every assessment item counts;
 * responses to items outside the assessment don't inflate the count; a null
 * assessment id fails closed.
 *
 * LR-3 / #333 changed what "delivered" means: getSessionCompleteness now
 * reads the session's FROZEN participant_section_forms (via
 * getOrCreateSectionForms) instead of recomputing the campaign-factor-filter
 * pipeline live on every call. Two consequences pinned below, which is why
 * this file no longer matches its pre-LR-3 shape:
 *
 *   1. A campaign's factor selection is captured the FIRST time a session's
 *      form is computed (its first getSessionCompleteness or getSessionState
 *      call) and is then STABLE for that session, however the campaign's
 *      selection changes afterwards. Before LR-3, completeness was
 *      recomputed from the LIVE selection on every call — so changing
 *      campaign_assessment_factors mid-session used to change what an
 *      already-in-flight session's completeness gate expected. That was
 *      exactly the bug LR-3 exists to close: editing a campaign's factor
 *      selection could silently change what a completed session "was" and
 *      desync the gate from what the participant actually saw.
 *   2. Since the two sessions below freeze independently (different
 *      session ids -> different participant_section_forms rows), each one's
 *      frozen set reflects whatever the campaign selection was AT ITS OWN
 *      first read, not a single shared "current" answer.
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
    // A second, independent session — used to pin that a campaign's factor
    // selection is captured at EACH session's own first freeze, not shared
    // "current" state (see file header, point 2).
    participantB: "",
    sessionB: "",
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

    const { data: participantB } = await adminDb
      .from("campaign_participants")
      .insert({
        campaign_id: ids.campaign,
        email: `sess-compl-b-${ts}@test.local`,
        first_name: "Test",
        last_name: "CompletenessB",
      })
      .select("id")
      .single();
    ids.participantB = participantB!.id;

    const { data: sessionB } = await adminDb
      .from("participant_sessions")
      .insert({
        assessment_id: ids.assessment,
        campaign_id: ids.campaign,
        campaign_participant_id: ids.participantB,
        client_id: ids.client,
        status: "in_progress",
      })
      .select("id")
      .single();
    ids.sessionB = sessionB!.id;
  }, 90_000);

  afterAll(async () => {
    if (!canRun) return;
    // participant_section_forms rows cascade-delete with their session
    // (ON DELETE CASCADE), so no explicit cleanup is needed for them.
    await adminDb.from("participant_responses").delete().eq("session_id", ids.session);
    await adminDb.from("participant_sessions").delete().eq("id", ids.session);
    await adminDb.from("campaign_participants").delete().eq("id", ids.participant);
    await adminDb.from("participant_responses").delete().eq("session_id", ids.sessionB);
    await adminDb.from("participant_sessions").delete().eq("id", ids.sessionB);
    await adminDb.from("campaign_participants").delete().eq("id", ids.participantB);
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

  it("a factor selection applied AFTER the session's form is already frozen has no effect (LR-3 / #333)", async () => {
    // ids.session was already frozen by the two tests above (no factor
    // selection was active then), locking in all 3 items. Selecting factor A
    // now — mid-session — must NOT retroactively shrink what's expected.
    // Before LR-3 this recomputed live and would have dropped to {expected:
    // 2}; that silent change is exactly the bug this feature closes.
    await adminDb.from("campaign_assessment_factors").insert({
      campaign_assessment_id: ids.campaignAssessment,
      factor_id: ids.factorA,
    });

    const afterSelection = await check();
    expect(afterSelection).toEqual({ expected: 3, answered: 1 });

    // itemChecky was already part of the frozen set — answering it moves
    // `answered`, but `expected` still doesn't move.
    await adminDb.from("participant_responses").insert({
      session_id: ids.session,
      item_id: ids.itemChecky,
      response_value: 4,
    });

    const afterAnswering = await check();
    expect(afterAnswering).toEqual({ expected: 3, answered: 2 });

    // itemB is still outstanding — genuinely delivered (it was in the
    // no-selection freeze), genuinely unanswered. The gate correctly still
    // withholds completion, which is the point: it was never optional for
    // this participant, whatever the campaign's selection says NOW.
    if ("error" in afterAnswering) throw new Error(afterAnswering.error);
    expect(afterAnswering.expected > afterAnswering.answered).toBe(true);
  });

  it("clearing the selection afterwards is equally inert, and the session completes once its actually-frozen items are all answered", async () => {
    await adminDb
      .from("campaign_assessment_factors")
      .delete()
      .eq("campaign_assessment_id", ids.campaignAssessment);

    // Still 3/2 — clearing the selection doesn't add anything back either;
    // the frozen set never moves once written.
    const afterClearing = await check();
    expect(afterClearing).toEqual({ expected: 3, answered: 2 });

    await adminDb.from("participant_responses").insert({
      session_id: ids.session,
      item_id: ids.itemB,
      response_value: 4,
    });

    const result = await check();
    expect(result).toEqual({ expected: 3, answered: 3 });
  });

  it("a factor selection active BEFORE a session's first read is what gets frozen for that session", async () => {
    // sessionB has never been read yet — this is its first freeze. Select
    // factor A first, so this pins the OTHER half of the property: the
    // selection in effect at first-read time is what sticks, per-session.
    await adminDb.from("campaign_assessment_factors").insert({
      campaign_assessment_id: ids.campaignAssessment,
      factor_id: ids.factorA,
    });

    const result = await getSessionCompleteness(adminDb, {
      sessionId: ids.sessionB,
      assessmentId: ids.assessment,
      campaignId: ids.campaign,
    });
    // Delivered = itemA (construct A) + the always-delivered non-construct
    // item. itemB (construct B) is excluded — never having been selected,
    // it was never frozen in, so it can never become expected for sessionB.
    expect(result).toEqual({ expected: 2, answered: 0 });

    // Clearing the selection now must not retroactively ADD itemB back in
    // for sessionB either — its form is frozen from the moment above.
    await adminDb
      .from("campaign_assessment_factors")
      .delete()
      .eq("campaign_assessment_id", ids.campaignAssessment);

    const afterClearing = await getSessionCompleteness(adminDb, {
      sessionId: ids.sessionB,
      assessmentId: ids.assessment,
      campaignId: ids.campaign,
    });
    expect(afterClearing).toEqual({ expected: 2, answered: 0 });
  });
});
