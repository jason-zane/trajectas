/**
 * getSessionCompleteness excludes unanswered items in an EXPIRED section
 * (LR-2 / #332 §3.5). Without this, a participant who ran out of time on a
 * timed section would trip submitSession's incomplete_submission guard
 * forever — the single most likely way to ship a broken timed test.
 *
 * Requires a running local Supabase instance. Run with
 * `npm run test:integration:local`.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSessionCompleteness } from "@/lib/dal/session-completeness";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";

const ts = Date.now();
const testSlug = (label: string) => `ess-${label}-${ts}`;

describe.skipIf(!canRun)("getSessionCompleteness — expired sections (LR-2 / #332)", () => {
  const adminDb = createAdminClient();

  const ids = {
    partner: "",
    client: "",
    responseFormat: "",
    assessment: "",
    sectionExpired: "",
    sectionOpen: "",
    itemAnsweredExpired: "",
    itemUnansweredExpired: "",
    itemUnansweredOpen: "",
    campaign: "",
    participant: "",
    session: "",
  };

  async function insertRow(table: string, row: Record<string, unknown>): Promise<string> {
    const { data, error } = await adminDb.from(table).insert(row).select("id").single();
    if (error) throw new Error(`${table} insert failed: ${error.message}`);
    return data!.id as string;
  }

  beforeAll(async () => {
    if (!canRun) return;

    ids.partner = await insertRow("partners", { name: `ESS Partner ${ts}`, slug: testSlug("partner") });
    ids.client = await insertRow("clients", {
      name: `ESS Client ${ts}`,
      slug: testSlug("client"),
      partner_id: ids.partner,
    });
    ids.responseFormat = await insertRow("response_formats", {
      name: `Likert ${ts}`,
      type: "likert",
      config: { points: 5 },
    });
    ids.assessment = await insertRow("assessments", {
      title: `ESS Assessment ${ts}`,
      slug: testSlug("assessment"),
      client_id: ids.client,
      partner_id: ids.partner,
      status: "active",
    });

    ids.sectionExpired = await insertRow("assessment_sections", {
      assessment_id: ids.assessment,
      response_format_id: ids.responseFormat,
      title: "Expired Section",
      time_limit_seconds: 60,
      display_order: 0,
    });
    ids.sectionOpen = await insertRow("assessment_sections", {
      assessment_id: ids.assessment,
      response_format_id: ids.responseFormat,
      title: "Open Section",
      display_order: 1,
    });

    ids.itemAnsweredExpired = await insertRow("items", {
      response_format_id: ids.responseFormat,
      stem: "Answered before the section expired",
      purpose: "impression_management",
    });
    ids.itemUnansweredExpired = await insertRow("items", {
      response_format_id: ids.responseFormat,
      stem: "Never reached — the section expired first",
      purpose: "impression_management",
    });
    ids.itemUnansweredOpen = await insertRow("items", {
      response_format_id: ids.responseFormat,
      stem: "Still required — its section has not expired",
      purpose: "impression_management",
    });

    await adminDb.from("assessment_section_items").insert([
      { section_id: ids.sectionExpired, item_id: ids.itemAnsweredExpired, display_order: 0 },
      { section_id: ids.sectionExpired, item_id: ids.itemUnansweredExpired, display_order: 1 },
      { section_id: ids.sectionOpen, item_id: ids.itemUnansweredOpen, display_order: 0 },
    ]);

    ids.campaign = await insertRow("campaigns", {
      title: `ESS Campaign ${ts}`,
      slug: testSlug("campaign"),
      client_id: ids.client,
      partner_id: ids.partner,
      status: "active",
    });
    await adminDb.from("campaign_assessments").insert({
      campaign_id: ids.campaign,
      assessment_id: ids.assessment,
      display_order: 0,
    });

    ids.participant = await insertRow("campaign_participants", {
      campaign_id: ids.campaign,
      email: `ess-${ts}@test.local`,
      first_name: "Timed",
      last_name: "Out",
      status: "in_progress",
      access_token: `ess-token-${ts}`,
    });
    ids.session = await insertRow("participant_sessions", {
      assessment_id: ids.assessment,
      campaign_id: ids.campaign,
      campaign_participant_id: ids.participant,
      client_id: ids.client,
      status: "in_progress",
    });

    // The participant answered ONE item before the clock ran out.
    await adminDb.from("participant_responses").insert({
      session_id: ids.session,
      item_id: ids.itemAnsweredExpired,
      section_id: ids.sectionExpired,
      response_value: 4,
    });

    // The expired section's state: deadline already passed, well past the
    // sweep threshold too, but NOT yet finalised — exercises the "deadline
    // in the past" branch of the completeness gate independently of
    // finalised_at (the sweep, or the client timer, may not have run yet).
    await adminDb.from("participant_section_states").insert({
      session_id: ids.session,
      section_id: ids.sectionExpired,
      started_at: new Date(Date.now() - 20 * 60_000).toISOString(),
      base_limit_seconds: 60,
      deadline_at: new Date(Date.now() - 19 * 60_000).toISOString(),
    });
  }, 90_000);

  afterAll(async () => {
    if (!canRun) return;
    await adminDb.from("participant_responses").delete().eq("session_id", ids.session);
    await adminDb.from("participant_section_states").delete().eq("session_id", ids.session);
    await adminDb.from("participant_sessions").delete().eq("id", ids.session);
    await adminDb.from("campaign_participants").delete().eq("id", ids.participant);
    await adminDb.from("campaign_assessments").delete().eq("campaign_id", ids.campaign);
    await adminDb.from("campaigns").delete().eq("id", ids.campaign);
    await adminDb
      .from("assessment_section_items")
      .delete()
      .in("section_id", [ids.sectionExpired, ids.sectionOpen]);
    await adminDb.from("assessment_sections").delete().in("id", [ids.sectionExpired, ids.sectionOpen]);
    await adminDb
      .from("items")
      .delete()
      .in("id", [ids.itemAnsweredExpired, ids.itemUnansweredExpired, ids.itemUnansweredOpen]);
    await adminDb.from("assessments").delete().eq("id", ids.assessment);
    await adminDb.from("response_formats").delete().eq("id", ids.responseFormat);
    await adminDb.from("clients").delete().eq("id", ids.client);
    await adminDb.from("partners").delete().eq("id", ids.partner);
  }, 60_000);

  it("excludes the unanswered item in the expired section, but still requires the one in the open section", async () => {
    const result = await getSessionCompleteness(adminDb, {
      sessionId: ids.session,
      assessmentId: ids.assessment,
      campaignId: ids.campaign,
    });

    if ("error" in result) throw new Error(result.error);

    // Expected: itemAnsweredExpired (answered) + itemUnansweredOpen (still
    // live). itemUnansweredExpired is dropped — its section timed out.
    expect(result.expected).toBe(2);
    expect(result.answered).toBe(1);
    // A hard-completeness caller (submitSession) would see answered < expected
    // (1 < 2) because the open section's item is genuinely still outstanding
    // — expiry excludes only the gap it actually caused.
  });

  it('does not treat manual finalization as an expired deadline', async () => {
    // Historical or tampered early finalization must not waive mandatory items.
    const { error } = await adminDb.from('participant_section_states').insert({
      session_id: ids.session, section_id: ids.sectionOpen,
      started_at: new Date().toISOString(), finalised_at: new Date().toISOString(),
      finalised_by: 'participant', deadline_at: null,
    });
    expect(error).toBeNull();
    expect(await getSessionCompleteness(adminDb, {
      sessionId: ids.session, assessmentId: ids.assessment, campaignId: ids.campaign,
    })).toEqual({ expected: 2, answered: 1 });
  });

  it("still counts an expired section's item if it WAS answered before time ran out", async () => {
    // Answer the open section's item too, so the session is now fully
    // "complete" under the relaxed gate.
    await adminDb.from("participant_responses").insert({
      session_id: ids.session,
      item_id: ids.itemUnansweredOpen,
      section_id: ids.sectionOpen,
      response_value: 2,
    });

    const result = await getSessionCompleteness(adminDb, {
      sessionId: ids.session,
      assessmentId: ids.assessment,
      campaignId: ids.campaign,
    });
    if ("error" in result) throw new Error(result.error);

    expect(result.expected).toBe(2);
    expect(result.answered).toBe(2);
  });
});
