import { getOrCreateSectionForms } from '@/lib/dal/session-forms';
/**
 * Practice-mode answer checking (LR-6 / #336) —
 * src/app/actions/assess-practice.ts#checkPracticeAnswer.
 *
 * Requires a running local Supabase instance — see
 * tests/integration/_helpers/rls-fixture.ts and
 * tests/architecture/integration-host-guard.test.ts. Run with
 * `npm run test:integration:local`.
 *
 * Covers:
 *   - correct/incorrect verdicts against item_answer_keys
 *   - the explanatory message: prefers the chosen option's
 *     item_option_diagnostics.rationale, falls back to
 *     item_answer_keys.rationale when no distractor-specific note exists
 *   - the load-bearing security property: an item in a 'scored'-role
 *     section is refused outright — this action must never become an
 *     answer oracle for scored items
 *   - option/item mismatch and missing-key are refused, not misreported
 *   - auth: a token that doesn't own the session is refused (same
 *     requireParticipantRuntimeSessionAccess path as every other action in
 *     src/app/actions/assess.ts)
 *   - a bonus sanity-check of the pre-written practice-completion gate
 *     itself (20260814100000_lr6_practice_completion_gate.sql):
 *     start_section_for_session blocks a 'scored' section with
 *     `{blocked: 'practice_incomplete'}` until every practice item in the
 *     assessment has a saved response, then unblocks it.
 */

import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";
import { checkPracticeAnswer } from "@/app/actions/assess-practice";

const ts = Date.now();
const slug = (s: string) => `pac-${s}-${ts}`.toLowerCase();

describe.skipIf(!canRun)("practice-mode answer checking", () => {
  const admin = createAdminClient();

  const token = randomBytes(32).toString("hex");
  const foreignToken = randomBytes(32).toString("hex");

  const ids = {
    responseFormat: "",
    construct: "",
    assessment: "",
    sectionPractice: "",
    sectionScored: "",
    campaign: "",
    participant: "",
    foreignParticipant: "",
    session: "",
    foreignSession: "",
    // Practice item with a distractor-specific rationale.
    itemA: "",
    itemACorrect: "",
    itemAWrong: "",
    // Practice item with no distractor-specific rationale (key-level fallback).
    itemB: "",
    itemBCorrect: "",
    itemBWrong: "",
    // Practice item with NO item_answer_keys row at all.
    itemD: "",
    itemDOption: "",
    // Scored item — must never be checkable via this action.
    itemC: "",
    itemCCorrect: "",
    itemCWrong: "",
  };

  async function ins(table: string, row: Record<string, unknown>): Promise<string> {
    const { data, error } = await admin.from(table).insert(row).select("id").single();
    if (error) throw new Error(`${table} insert failed: ${error.message}`);
    return data!.id as string;
  }

  beforeAll(async () => {
    if (!canRun) return;

    ids.responseFormat = await ins("response_formats", {
      name: `PAC Cognitive ${ts}`,
      type: "cognitive",
      config: {},
    });
    ids.construct = await ins("constructs", {
      name: `PAC Construct ${ts}`,
      slug: slug("construct"),
    });
    ids.assessment = await ins("assessments", {
      title: `PAC Assessment ${ts}`,
      slug: slug("assessment"),
    });

    ids.sectionPractice = await ins("assessment_sections", {
      assessment_id: ids.assessment,
      response_format_id: ids.responseFormat,
      title: "Practice",
      section_role: "practice",
      display_order: 0,
    });
    ids.sectionScored = await ins("assessment_sections", {
      assessment_id: ids.assessment,
      response_format_id: ids.responseFormat,
      title: "Scored",
      section_role: "scored",
      display_order: 1,
    });

    // --- itemA: practice item WITH a distractor-specific diagnostic ---
    ids.itemA = await ins("items", {
      response_format_id: ids.responseFormat,
      stem: `PAC A ${ts}`,
      construct_id: ids.construct,
      purpose: "practice",
      status: "active",
    });
    ids.itemACorrect = await ins("item_options", {
      item_id: ids.itemA,
      label: "Correct",
      value: 1,
      display_order: 0,
    });
    ids.itemAWrong = await ins("item_options", {
      item_id: ids.itemA,
      label: "Wrong",
      value: 2,
      display_order: 1,
    });
    await admin.from("item_answer_keys").insert({
      item_id: ids.itemA,
      correct_option_id: ids.itemACorrect,
      rationale: "General key-level rationale for A — should NOT be used, a distractor note exists.",
    });
    await admin.from("item_option_diagnostics").insert({
      option_id: ids.itemAWrong,
      item_id: ids.itemA,
      error_label: "WR",
      rationale: "Distractor-specific rationale for A's wrong option.",
    });

    // --- itemB: practice item with NO distractor diagnostic (key fallback) ---
    ids.itemB = await ins("items", {
      response_format_id: ids.responseFormat,
      stem: `PAC B ${ts}`,
      construct_id: ids.construct,
      purpose: "practice",
      status: "active",
    });
    ids.itemBCorrect = await ins("item_options", {
      item_id: ids.itemB,
      label: "Correct",
      value: 1,
      display_order: 0,
    });
    ids.itemBWrong = await ins("item_options", {
      item_id: ids.itemB,
      label: "Wrong",
      value: 2,
      display_order: 1,
    });
    await admin.from("item_answer_keys").insert({
      item_id: ids.itemB,
      correct_option_id: ids.itemBCorrect,
      rationale: "Key-level rationale for B — no distractor note exists, so this should surface.",
    });

    // --- itemD: practice item with NO item_answer_keys row ---
    ids.itemD = await ins("items", {
      response_format_id: ids.responseFormat,
      stem: `PAC D ${ts}`,
      construct_id: ids.construct,
      purpose: "practice",
      status: "active",
    });
    ids.itemDOption = await ins("item_options", {
      item_id: ids.itemD,
      label: "Only option",
      value: 1,
      display_order: 0,
    });

    // --- itemC: SCORED item — must be unreachable via checkPracticeAnswer ---
    ids.itemC = await ins("items", {
      response_format_id: ids.responseFormat,
      stem: `PAC C (scored) ${ts}`,
      construct_id: ids.construct,
      purpose: "construct",
      status: "active",
    });
    ids.itemCCorrect = await ins("item_options", {
      item_id: ids.itemC,
      label: "Correct",
      value: 1,
      display_order: 0,
    });
    ids.itemCWrong = await ins("item_options", {
      item_id: ids.itemC,
      label: "Wrong",
      value: 2,
      display_order: 1,
    });
    await admin.from("item_answer_keys").insert({
      item_id: ids.itemC,
      correct_option_id: ids.itemCCorrect,
    });

    await admin.from("assessment_section_items").insert([
      { section_id: ids.sectionPractice, item_id: ids.itemA, display_order: 0 },
      { section_id: ids.sectionPractice, item_id: ids.itemB, display_order: 1 },
      { section_id: ids.sectionPractice, item_id: ids.itemD, display_order: 2 },
      { section_id: ids.sectionScored, item_id: ids.itemC, display_order: 0 },
    ]);

    ids.campaign = await ins("campaigns", {
      title: `PAC Campaign ${ts}`,
      slug: slug("campaign"),
      status: "active",
    });
    await admin.from("campaign_assessments").insert({
      campaign_id: ids.campaign,
      assessment_id: ids.assessment,
      display_order: 0,
    });

    ids.participant = await ins("campaign_participants", {
      campaign_id: ids.campaign,
      email: `pac-${ts}@test.local`,
      first_name: "Practice",
      last_name: "Tester",
      status: "in_progress",
      access_token: token,
    });
    ids.session = await ins("participant_sessions", {
      assessment_id: ids.assessment,
      campaign_id: ids.campaign,
      campaign_participant_id: ids.participant,
      status: "in_progress",
    });

    // A second, unrelated participant/session — proves a token can't be used
    // to check answers against a session it doesn't own.
    ids.foreignParticipant = await ins("campaign_participants", {
      campaign_id: ids.campaign,
      email: `pac-foreign-${ts}@test.local`,
      first_name: "Foreign",
      last_name: "Tester",
      status: "in_progress",
      access_token: foreignToken,
    });
    ids.foreignSession = await ins("participant_sessions", {
      assessment_id: ids.assessment,
      campaign_id: ids.campaign,
      campaign_participant_id: ids.foreignParticipant,
      status: "in_progress",
    });
    for (const sessionId of [ids.session, ids.foreignSession]) {
      const forms = await getOrCreateSectionForms(admin, { sessionId, assessmentId: ids.assessment, campaignId: ids.campaign });
      expect('error' in forms).toBe(false);
    }

  }, 90_000);

  afterAll(async () => {
    if (!canRun) return;
    const itemIds = [ids.itemA, ids.itemB, ids.itemC, ids.itemD].filter(Boolean);
    await admin.from("participant_responses").delete().in("session_id", [ids.session, ids.foreignSession]);
    await admin.from("participant_section_states").delete().in("session_id", [ids.session, ids.foreignSession]);
    await admin.from("participant_sessions").delete().in("id", [ids.session, ids.foreignSession]);
    await admin.from("campaign_participants").delete().in("id", [ids.participant, ids.foreignParticipant]);
    await admin.from("campaign_assessments").delete().eq("campaign_id", ids.campaign);
    await admin.from("campaigns").delete().eq("id", ids.campaign);
    await admin.from("assessment_section_items").delete().in("section_id", [ids.sectionPractice, ids.sectionScored]);
    await admin.from("assessment_sections").delete().in("id", [ids.sectionPractice, ids.sectionScored]);
    await admin.from("item_answer_keys").delete().in("item_id", itemIds);
    await admin.from("item_option_diagnostics").delete().in("item_id", itemIds);
    await admin.from("item_options").delete().in("item_id", itemIds);
    await admin.from("items").delete().in("id", itemIds);
    await admin.from("assessments").delete().eq("id", ids.assessment);
    await admin.from("constructs").delete().eq("id", ids.construct);
    await admin.from("response_formats").delete().eq("id", ids.responseFormat);
  }, 60_000);

  it("returns correct: true for the right option, with no other fields", async () => {
    const result = await checkPracticeAnswer(token, ids.session, ids.itemA, ids.itemACorrect);
    expect(result).toEqual({ correct: true });
  });

  it("returns correct: false with the distractor-specific rationale when one exists", async () => {
    const result = await checkPracticeAnswer(token, ids.session, ids.itemA, ids.itemAWrong);
    expect(result).toEqual({
      correct: false,
      message: "Distractor-specific rationale for A's wrong option.",
    });
  });

  it("falls back to the answer key's rationale when no distractor-specific diagnostic exists", async () => {
    const result = await checkPracticeAnswer(token, ids.session, ids.itemB, ids.itemBWrong);
    expect(result).toEqual({
      correct: false,
      message: "Key-level rationale for B — no distractor note exists, so this should surface.",
    });
  });

  it("never returns the correct option id, even on a miss", async () => {
    const result = await checkPracticeAnswer(token, ids.session, ids.itemA, ids.itemAWrong);
    expect(Object.keys(result).sort()).toEqual(["correct", "message"]);
    expect(JSON.stringify(result)).not.toContain(ids.itemACorrect);
  });

  it("refuses to check an item in a SCORED section — never an answer oracle for scored items", async () => {
    const result = await checkPracticeAnswer(token, ids.session, ids.itemC, ids.itemCCorrect);
    expect("error" in result).toBe(true);
    // The load-bearing property: whichever way it fails, it must never say
    // whether the guess against the scored item was right.
    expect("correct" in result).toBe(false);
  });

  it("refuses when the chosen option doesn't belong to the item", async () => {
    // itemB's option, submitted against itemA.
    const result = await checkPracticeAnswer(token, ids.session, ids.itemA, ids.itemBCorrect);
    expect("error" in result).toBe(true);
  });

  it("refuses when the item has no answer key configured", async () => {
    const result = await checkPracticeAnswer(token, ids.session, ids.itemD, ids.itemDOption);
    expect("error" in result).toBe(true);
  });

  it("refuses a token that does not own the session (same auth path as the other assess actions)", async () => {
    const result = await checkPracticeAnswer(foreignToken, ids.session, ids.itemA, ids.itemACorrect);
    expect("error" in result).toBe(true);
  });

  it("refuses an item that doesn't belong to the session's assessment", async () => {
    // A well-formed but nonexistent item id — exercises resolvePracticeSectionItem's
    // "no matching assessment_section_items row" path, not zod input validation.
    const result = await checkPracticeAnswer(token, ids.session, randomUUID(), ids.itemACorrect);
    expect("error" in result).toBe(true);
    expect("correct" in result).toBe(false);
  });

  // ---------------------------------------------------------------------
  // Bonus: sanity-check the pre-written practice-completion gate itself
  // (20260814100000_lr6_practice_completion_gate.sql) against a live RPC
  // call, not just a read-through.
  // ---------------------------------------------------------------------
  it("start_section_for_session blocks the scored section until every practice item is answered, then unblocks it", async () => {
    const { data: blocked, error: blockedErr } = await admin.rpc("start_section_for_session", {
      p_access_token: token,
      p_session_id: ids.session,
      p_section_id: ids.sectionScored,
    });
    expect(blockedErr).toBeNull();
    expect(blocked).toEqual({ blocked: "practice_incomplete" });

    // Answer every practice item directly via the save RPC (no
    // start_section_for_session call for the practice section first — the
    // migration's header explicitly requires the save RPCs to be the
    // authoritative chokepoint on their own).
    for (const [itemId, value] of [
      [ids.itemA, 1],
      [ids.itemB, 1],
      [ids.itemD, 1],
    ] as const) {
      const { data: saved, error: saveErr } = await admin.rpc("save_response_for_session", {
        p_access_token: token,
        p_session_id: ids.session,
        p_item_id: itemId,
        p_section_id: ids.sectionPractice,
        p_response_value: value,
        p_response_data: {},
        p_response_time_ms: null,
      });
      expect(saveErr).toBeNull();
      expect(saved).toBe(true);
    }

    const { data: unblocked, error: unblockedErr } = await admin.rpc("start_section_for_session", {
      p_access_token: token,
      p_session_id: ids.session,
      p_section_id: ids.sectionScored,
    });
    expect(unblockedErr).toBeNull();
    expect(unblocked.blocked).toBeUndefined();
    expect(unblocked.startedAt).toBeTruthy();
  }, 20_000);
});
