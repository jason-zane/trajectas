/**
 * getSessionCompleteness — backs the submitSession hard completeness gate
 * (an in-progress session may only be completed once every item in the
 * assessment has a saved response).
 *
 * Pins: expected counts every item currently in the assessment; answered
 * counts only responses to those items (a stale response to an item that
 * was never part of the assessment does not inflate the count); a null
 * assessment id fails closed with an error.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSessionCompleteness } from "@/lib/assess/session-completeness";
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
    itemA: "",
    itemB: "",
    itemOutside: "",
    campaign: "",
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

    async function makeItem(stem: string) {
      const { data: item } = await adminDb
        .from("items")
        .insert({
          response_format_id: ids.responseFormat,
          stem,
          purpose: "impression_management",
        })
        .select("id")
        .single();
      return item!.id as string;
    }
    ids.itemA = await makeItem("Item A");
    ids.itemB = await makeItem("Item B");
    // Belongs to no section of this assessment — a response to it must not count.
    ids.itemOutside = await makeItem("Item outside");

    await adminDb.from("assessment_section_items").insert([
      { section_id: ids.section, item_id: ids.itemA, display_order: 0 },
      { section_id: ids.section, item_id: ids.itemB, display_order: 1 },
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
    await adminDb.from("campaigns").delete().eq("id", ids.campaign);
    await adminDb.from("assessment_section_items").delete().eq("section_id", ids.section);
    await adminDb.from("assessment_sections").delete().eq("id", ids.section);
    await adminDb
      .from("items")
      .delete()
      .in("id", [ids.itemA, ids.itemB, ids.itemOutside]);
    await adminDb.from("assessments").delete().eq("id", ids.assessment);
    await adminDb.from("response_formats").delete().eq("id", ids.responseFormat);
    await adminDb.from("clients").delete().eq("id", ids.client);
    await adminDb.from("partners").delete().eq("id", ids.partner);
  }, 60_000);

  it("fails closed when the session has no assessment id", async () => {
    const result = await getSessionCompleteness(adminDb, ids.session, null);
    expect(result).toHaveProperty("error");
  });

  it("reports missing answers while items are unanswered", async () => {
    await adminDb.from("participant_responses").insert({
      session_id: ids.session,
      item_id: ids.itemA,
      response_value: 3,
    });

    const result = await getSessionCompleteness(adminDb, ids.session, ids.assessment);
    expect(result).toEqual({ expected: 2, answered: 1 });
  });

  it("ignores responses to items that are not part of the assessment", async () => {
    await adminDb.from("participant_responses").insert({
      session_id: ids.session,
      item_id: ids.itemOutside,
      response_value: 5,
    });

    const result = await getSessionCompleteness(adminDb, ids.session, ids.assessment);
    expect(result).toEqual({ expected: 2, answered: 1 });
  });

  it("reports complete once every assessment item has a response", async () => {
    await adminDb.from("participant_responses").insert({
      session_id: ids.session,
      item_id: ids.itemB,
      response_value: 4,
    });

    const result = await getSessionCompleteness(adminDb, ids.session, ids.assessment);
    expect(result).toEqual({ expected: 2, answered: 2 });
  });
});
