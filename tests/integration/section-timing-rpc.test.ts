/**
 * Server-authoritative section timing (LR-2 / #332):
 *   start_section_for_session, finalise_section_for_session, and the
 *   deadline / back-navigation enforcement patched into
 *   save_response_for_session + save_responses_batch_for_session.
 *
 * Requires a running local Supabase instance — see
 * tests/integration/_helpers/rls-fixture.ts and
 * tests/architecture/integration-host-guard.test.ts. Run with
 * `npm run test:integration:local`.
 *
 * Empirically verified independently against a throwaway Postgres cluster
 * via scripts/pg-migrate-check.sh --keep-running + psql (documented in the
 * PR description) — this suite pins the same behaviour against the real
 * Supabase stack (RLS, PostgREST-shaped RPC calls) for CI.
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";

const ts = Date.now();
const testSlug = (label: string) => `stt-${label}-${ts}`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe.skipIf(!canRun)("section timing RPCs", () => {
  const adminDb = createAdminClient();

  const tokenA = randomBytes(32).toString("hex");
  const tokenB = randomBytes(32).toString("hex");

  const ids = {
    partner: "",
    client: "",
    responseFormat: "",
    assessment: "",
    // 2s limit / 2s grace — short enough to exercise expiry without a slow suite.
    sectionShort: "",
    itemShort: "",
    // Untimed, allow_back_nav = false.
    sectionNoBackNav: "",
    itemNoBackNav: "",
    // Timed, default allow_back_nav = true (regression guard).
    sectionBackNav: "",
    itemBackNav: "",
    campaign: "",
    participantA: "",
    sessionA: "",
    participantB: "",
    sessionB: "",
  };

  async function insertRow(table: string, row: Record<string, unknown>): Promise<string> {
    const { data, error } = await adminDb.from(table).insert(row).select("id").single();
    if (error) throw new Error(`${table} insert failed: ${error.message}`);
    return data!.id as string;
  }

  beforeAll(async () => {
    if (!canRun) return;

    ids.partner = await insertRow("partners", {
      name: `STT Partner ${ts}`,
      slug: testSlug("partner"),
    });
    ids.client = await insertRow("clients", {
      name: `STT Client ${ts}`,
      slug: testSlug("client"),
      partner_id: ids.partner,
    });
    ids.responseFormat = await insertRow("response_formats", {
      name: `Likert ${ts}`,
      type: "likert",
      config: { points: 5 },
    });
    ids.assessment = await insertRow("assessments", {
      title: `STT Assessment ${ts}`,
      slug: testSlug("assessment"),
      client_id: ids.client,
      partner_id: ids.partner,
      status: "active",
    });

    ids.sectionShort = await insertRow("assessment_sections", {
      assessment_id: ids.assessment,
      response_format_id: ids.responseFormat,
      title: "Short Timed Section",
      time_limit_seconds: 2,
      grace_seconds: 2,
    });
    ids.itemShort = await insertRow("items", {
      response_format_id: ids.responseFormat,
      stem: "Short-section item",
      purpose: "impression_management",
    });
    await adminDb.from("assessment_section_items").insert({
      section_id: ids.sectionShort,
      item_id: ids.itemShort,
      display_order: 0,
    });

    ids.sectionNoBackNav = await insertRow("assessment_sections", {
      assessment_id: ids.assessment,
      response_format_id: ids.responseFormat,
      title: "No Back-Nav Section",
      allow_back_nav: false,
    });
    ids.itemNoBackNav = await insertRow("items", {
      response_format_id: ids.responseFormat,
      stem: "No-back-nav item",
      purpose: "impression_management",
    });
    await adminDb.from("assessment_section_items").insert({
      section_id: ids.sectionNoBackNav,
      item_id: ids.itemNoBackNav,
      display_order: 0,
    });

    ids.sectionBackNav = await insertRow("assessment_sections", {
      assessment_id: ids.assessment,
      response_format_id: ids.responseFormat,
      title: "Default Back-Nav Section",
      time_limit_seconds: 600,
    });
    ids.itemBackNav = await insertRow("items", {
      response_format_id: ids.responseFormat,
      stem: "Default-back-nav item",
      purpose: "impression_management",
    });
    await adminDb.from("assessment_section_items").insert({
      section_id: ids.sectionBackNav,
      item_id: ids.itemBackNav,
      display_order: 0,
    });

    ids.campaign = await insertRow("campaigns", {
      title: `STT Campaign ${ts}`,
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

    ids.participantA = await insertRow("campaign_participants", {
      campaign_id: ids.campaign,
      email: `stt-a-${ts}@test.local`,
      first_name: "Alice",
      last_name: "Timing",
      status: "in_progress",
      access_token: tokenA,
    });
    ids.sessionA = await insertRow("participant_sessions", {
      assessment_id: ids.assessment,
      campaign_id: ids.campaign,
      campaign_participant_id: ids.participantA,
      client_id: ids.client,
      status: "in_progress",
    });

    ids.participantB = await insertRow("campaign_participants", {
      campaign_id: ids.campaign,
      email: `stt-b-${ts}@test.local`,
      first_name: "Bob",
      last_name: "Accommodated",
      status: "in_progress",
      access_token: tokenB,
    });
    ids.sessionB = await insertRow("participant_sessions", {
      assessment_id: ids.assessment,
      campaign_id: ids.campaign,
      campaign_participant_id: ids.participantB,
      client_id: ids.client,
      status: "in_progress",
    });
    // Bob has a +50% extra-time accommodation for this assessment.
    await adminDb.from("participant_accommodations").insert({
      campaign_participant_id: ids.participantB,
      assessment_id: ids.assessment,
      kind: "extra_time",
      time_multiplier: 1.5,
      reason_category: "disability",
    });
  }, 90_000);

  afterAll(async () => {
    if (!canRun) return;
    await adminDb.from("participant_responses").delete().in("session_id", [ids.sessionA, ids.sessionB]);
    await adminDb
      .from("participant_section_states")
      .delete()
      .in("session_id", [ids.sessionA, ids.sessionB]);
    await adminDb.from("participant_accommodations").delete().eq("campaign_participant_id", ids.participantB);
    await adminDb.from("participant_sessions").delete().in("id", [ids.sessionA, ids.sessionB]);
    await adminDb.from("campaign_participants").delete().in("id", [ids.participantA, ids.participantB]);
    await adminDb.from("campaign_assessments").delete().eq("campaign_id", ids.campaign);
    await adminDb.from("campaigns").delete().eq("id", ids.campaign);
    await adminDb
      .from("assessment_section_items")
      .delete()
      .in("section_id", [ids.sectionShort, ids.sectionNoBackNav, ids.sectionBackNav]);
    await adminDb
      .from("assessment_sections")
      .delete()
      .in("id", [ids.sectionShort, ids.sectionNoBackNav, ids.sectionBackNav]);
    await adminDb
      .from("items")
      .delete()
      .in("id", [ids.itemShort, ids.itemNoBackNav, ids.itemBackNav]);
    await adminDb.from("assessments").delete().eq("id", ids.assessment);
    await adminDb.from("response_formats").delete().eq("id", ids.responseFormat);
    await adminDb.from("clients").delete().eq("id", ids.client);
    await adminDb.from("partners").delete().eq("id", ids.partner);
  }, 60_000);

  it("start_section_for_session is idempotent: a second call resumes the SAME startedAt/deadlineAt", async () => {
    const { data: first, error: e1 } = await adminDb.rpc("start_section_for_session", {
      p_access_token: tokenA,
      p_session_id: ids.sessionA,
      p_section_id: ids.sectionShort,
    });
    expect(e1).toBeNull();
    expect(first.deadlineAt).toBeTruthy();

    const { data: second, error: e2 } = await adminDb.rpc("start_section_for_session", {
      p_access_token: tokenA,
      p_session_id: ids.sessionA,
      p_section_id: ids.sectionShort,
    });
    expect(e2).toBeNull();
    expect(second.startedAt).toBe(first.startedAt);
    expect(second.deadlineAt).toBe(first.deadlineAt);
  });

  it("applies a 1.5x accommodation multiplier to the deadline", async () => {
    const { data, error } = await adminDb.rpc("start_section_for_session", {
      p_access_token: tokenB,
      p_session_id: ids.sessionB,
      p_section_id: ids.sectionBackNav, // 600s base limit
    });
    expect(error).toBeNull();
    expect(data.multiplier).toBe(1.5);

    const startedMs = Date.parse(data.startedAt);
    const deadlineMs = Date.parse(data.deadlineAt);
    // ceil(600 * 1.5) = 900s.
    expect(Math.round((deadlineMs - startedMs) / 1000)).toBe(900);
  });

  it("accepts a save inside the deadline, rejects one past deadline + grace, and never clamps the stored value", async () => {
    await adminDb.rpc("start_section_for_session", {
      p_access_token: tokenA,
      p_session_id: ids.sessionA,
      p_section_id: ids.sectionShort,
    });

    const { data: savedOk } = await adminDb.rpc("save_response_for_session", {
      p_access_token: tokenA,
      p_session_id: ids.sessionA,
      p_item_id: ids.itemShort,
      p_section_id: ids.sectionShort,
      p_response_value: 3,
      p_response_data: {},
      p_response_time_ms: null,
    });
    expect(savedOk).toBe(true);

    // 2s limit + 2s grace = 4s window. Sleep past it.
    await sleep(4500);

    const { data: savedLate } = await adminDb.rpc("save_response_for_session", {
      p_access_token: tokenA,
      p_session_id: ids.sessionA,
      p_item_id: ids.itemShort,
      p_section_id: ids.sectionShort,
      p_response_value: 5,
      p_response_data: {},
      p_response_time_ms: null,
    });
    expect(savedLate).toBe(false);

    const { data: row } = await adminDb
      .from("participant_responses")
      .select("response_value, answered_at")
      .eq("session_id", ids.sessionA)
      .eq("item_id", ids.itemShort)
      .single();
    expect(Number(row!.response_value)).toBe(3);
    expect(row!.answered_at).toBeTruthy();

    // The batch RPC enforces the same deadline+grace window.
    const { data: batchResult } = await adminDb.rpc("save_responses_batch_for_session", {
      p_access_token: tokenA,
      p_session_id: ids.sessionA,
      p_saves: [
        { itemId: ids.itemShort, responseValue: 5, responseData: {}, responseTimeMs: null },
      ],
    });
    expect(batchResult).toEqual([]);
  }, 20_000);

  it("finalise_section_for_session refuses a 'client_timer' claim before the deadline, honours 'participant' always, and locks the section against further writes", async () => {
    await adminDb.rpc("start_section_for_session", {
      p_access_token: tokenB,
      p_session_id: ids.sessionB,
      p_section_id: ids.sectionNoBackNav,
    });

    // Untimed section — a tampered "the timer went off" claim must be refused.
    const { data: tooEarly } = await adminDb.rpc("finalise_section_for_session", {
      p_access_token: tokenB,
      p_session_id: ids.sessionB,
      p_section_id: ids.sectionNoBackNav,
      p_reason: "client_timer",
    });
    expect(tooEarly).toBeNull();

    const { data: finalised } = await adminDb.rpc("finalise_section_for_session", {
      p_access_token: tokenB,
      p_session_id: ids.sessionB,
      p_section_id: ids.sectionNoBackNav,
      p_reason: "participant",
    });
    expect(finalised.finalised).toBe(true);
    expect(finalised.finalisedBy).toBe("participant");

    const { data: rejectedAfterFinalise } = await adminDb.rpc("save_response_for_session", {
      p_access_token: tokenB,
      p_session_id: ids.sessionB,
      p_item_id: ids.itemNoBackNav,
      p_section_id: ids.sectionNoBackNav,
      p_response_value: 1,
      p_response_data: {},
      p_response_time_ms: null,
    });
    expect(rejectedAfterFinalise).toBe(false);
  });

  it("locks an item once answered in a section with allow_back_nav = false, but not in a default section", async () => {
    await adminDb.rpc("start_section_for_session", {
      p_access_token: tokenA,
      p_session_id: ids.sessionA,
      p_section_id: ids.sectionNoBackNav,
    });

    const { data: firstSave } = await adminDb.rpc("save_response_for_session", {
      p_access_token: tokenA,
      p_session_id: ids.sessionA,
      p_item_id: ids.itemNoBackNav,
      p_section_id: ids.sectionNoBackNav,
      p_response_value: 2,
      p_response_data: {},
      p_response_time_ms: null,
    });
    expect(firstSave).toBe(true);

    const { data: overwriteAttempt } = await adminDb.rpc("save_response_for_session", {
      p_access_token: tokenA,
      p_session_id: ids.sessionA,
      p_item_id: ids.itemNoBackNav,
      p_section_id: ids.sectionNoBackNav,
      p_response_value: 5,
      p_response_data: {},
      p_response_time_ms: null,
    });
    expect(overwriteAttempt).toBe(false);

    const { data: row } = await adminDb
      .from("participant_responses")
      .select("response_value")
      .eq("session_id", ids.sessionA)
      .eq("item_id", ids.itemNoBackNav)
      .single();
    expect(Number(row!.response_value)).toBe(2);

    // Regression guard: a section that doesn't opt out of back-nav still
    // allows overwriting an earlier answer, exactly like before this change.
    await adminDb.rpc("start_section_for_session", {
      p_access_token: tokenA,
      p_session_id: ids.sessionA,
      p_section_id: ids.sectionBackNav,
    });
    await adminDb.rpc("save_response_for_session", {
      p_access_token: tokenA,
      p_session_id: ids.sessionA,
      p_item_id: ids.itemBackNav,
      p_section_id: ids.sectionBackNav,
      p_response_value: 1,
      p_response_data: {},
      p_response_time_ms: null,
    });
    const { data: overwriteOk } = await adminDb.rpc("save_response_for_session", {
      p_access_token: tokenA,
      p_session_id: ids.sessionA,
      p_item_id: ids.itemBackNav,
      p_section_id: ids.sectionBackNav,
      p_response_value: 4,
      p_response_data: {},
      p_response_time_ms: null,
    });
    expect(overwriteOk).toBe(true);
  });
});
