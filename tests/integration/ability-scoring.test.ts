/**
 * End-to-end test for scoreSessionAbility (LR-5, #335): dichotomous
 * sum-correct scoring against item_answer_keys, scored against the
 * session's FROZEN form (participant_section_forms), with per-item outcome
 * persistence and rapid-guess/effort flagging.
 *
 * Requires a running local Supabase instance — see
 * tests/integration/_helpers/rls-fixture.ts and
 * tests/architecture/integration-host-guard.test.ts. Run with
 * `npm run test:integration:local`.
 *
 * Fixture layout — two sections, two factors:
 *
 *   Section "Matrix" (LR-M, untimed — no participant_section_states row),
 *   fixed ordering, 5 items:
 *     pos1 M-Correct    construct, answered correctly, 500ms   -> correct,   rapid_guess=true  (no server
 *                                                                  anchor -> client_fallback)
 *     pos2 M-Incorrect  construct, answered wrongly, answered
 *                       2000ms after pos1 (client reports 8000ms,
 *                       which the scorer must NOT trust)        -> incorrect, rapid_guess=true  (server_gap
 *                                                                  overrides the misleading client value)
 *     pos3 M-Omitted    construct, no response, section not
 *                       expired                                 -> omitted (seen and skipped)
 *     pos4 M-Practice   practice, answered                      -> excluded, never counted
 *     pos5 M-Seed       seed, answered correctly                -> correct, counted for calibration only
 *
 *   Matrix factor: raw_correct=1, items_used=3, items_attempted=2,
 *   scaled_score = 100/3.
 *
 *   Section "Deductive" (LR-D, TIMED and EXPIRED — finalised_at set),
 *   fixed ordering, 4 construct items:
 *     pos1 D-Correct    answered correctly, 6000ms after section
 *                       start                                   -> correct, NOT rapid_guess (>= 4000ms floor)
 *     pos2 D-Gap        no response                              -> high-water mark is pos3 (below), so this
 *                                                                    is 'omitted' (seen, skipped)
 *     pos3 D-Incorrect  answered wrongly, 1000ms after pos1       -> incorrect, rapid_guess=true
 *     pos4 D-NeverSeen  no response                              -> past the high-water mark -> 'expired_unseen'
 *
 *   Deductive factor: raw_correct=1, items_used=4, items_attempted=2,
 *   scaled_score = 25.
 *
 *   Composite (no assessment_factors.composite_weight configured -> equal
 *   weighting): (100/3 + 25) / 2 = 29.1666...7, composite_method =
 *   'mean_of_children'.
 *
 *   Response Time Effort, across every counts_toward_score item in the
 *   session (3 + 4 = 7): only D-Correct's 6000ms clears its 4000ms floor,
 *   so RTE = 1/7 ≈ 0.142857 -> tier 'blocking' -> a participant_session_flags
 *   row is persisted (NOT wired to score withholding in this slice — see
 *   the migration header).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";
import { scoreSessionAbility } from "@/lib/scoring/ability-session";

const ts = Date.now();
const slug = (s: string) => `abs-${s}-${ts}`.toLowerCase();

describe.skipIf(!canRun)("scoring: scoreSessionAbility (dichotomous, frozen form)", () => {
  const admin = createAdminClient();

  const ids = {
    responseFormat: "",
    assessment: "",
    session: "",
    factorMatrix: "",
    factorDeductive: "",
    constructMatrix: "",
    constructDeductive: "",
    familyMatrix: "",
    familyDeductive: "",
    sectionMatrix: "",
    sectionDeductive: "",
    items: {} as Record<string, string>,
    options: {} as Record<string, { correct: string; wrong: string }>,
  };

  async function ins(table: string, row: Record<string, unknown>): Promise<string> {
    const { data, error } = await admin.from(table).insert(row).select("id").single();
    if (error) throw new Error(`${table} insert: ${error.message}`);
    return data!.id as string;
  }

  async function makeKeyedItem(opts: {
    label: string;
    constructId: string;
    familyId: string | null;
    purpose: "construct" | "practice" | "seed";
    responseFormatId: string;
  }): Promise<{ itemId: string; correctOptionId: string; wrongOptionId: string }> {
    const itemId = await ins("items", {
      response_format_id: opts.responseFormatId,
      stem: `${opts.label} ${ts}`,
      construct_id: opts.constructId,
      family_id: opts.familyId,
      purpose: opts.purpose,
      status: "active",
    });
    const correctOptionId = await ins("item_options", {
      item_id: itemId,
      label: "Correct",
      value: 1,
      display_order: 0,
    });
    const wrongOptionId = await ins("item_options", {
      item_id: itemId,
      label: "Wrong",
      value: 2,
      display_order: 1,
    });
    await admin.from("item_answer_keys").insert({ item_id: itemId, correct_option_id: correctOptionId });
    return { itemId, correctOptionId, wrongOptionId };
  }

  beforeAll(async () => {
    if (!canRun) return;

    ids.responseFormat = await ins("response_formats", {
      name: `ABS Cognitive ${ts}`,
      type: "cognitive",
      config: {},
    });
    ids.assessment = await ins("assessments", {
      title: `ABS Assessment ${ts}`,
      slug: slug("assessment"),
      scoring_profile: "ability_dichotomous",
    });

    ids.factorMatrix = await ins("factors", { name: `ABS Matrix ${ts}`, slug: slug("factor-matrix") });
    ids.factorDeductive = await ins("factors", { name: `ABS Deductive ${ts}`, slug: slug("factor-deductive") });
    ids.constructMatrix = await ins("constructs", { name: `ABS Matrix Construct ${ts}`, slug: slug("construct-matrix") });
    ids.constructDeductive = await ins("constructs", {
      name: `ABS Deductive Construct ${ts}`,
      slug: slug("construct-deductive"),
    });
    await admin.from("factor_constructs").insert([
      { factor_id: ids.factorMatrix, construct_id: ids.constructMatrix, weight: 1.0 },
      { factor_id: ids.factorDeductive, construct_id: ids.constructDeductive, weight: 1.0 },
    ]);
    await admin.from("assessment_factors").insert([
      { assessment_id: ids.assessment, factor_id: ids.factorMatrix },
      { assessment_id: ids.assessment, factor_id: ids.factorDeductive },
    ]);

    ids.familyMatrix = await ins("item_families", {
      code: slug("family-matrix"),
      construct_id: ids.constructMatrix,
      kind: "figural_matrix",
    });
    ids.familyDeductive = await ins("item_families", {
      code: slug("family-deductive"),
      construct_id: ids.constructDeductive,
      kind: "deductive",
    });

    ids.sectionMatrix = await ins("assessment_sections", {
      assessment_id: ids.assessment,
      response_format_id: ids.responseFormat,
      title: "Matrix",
      item_ordering: "fixed",
    });
    ids.sectionDeductive = await ins("assessment_sections", {
      assessment_id: ids.assessment,
      response_format_id: ids.responseFormat,
      title: "Deductive",
      item_ordering: "fixed",
    });

    // --- Matrix section items ---
    const mCorrect = await makeKeyedItem({
      label: "M-Correct",
      constructId: ids.constructMatrix,
      familyId: ids.familyMatrix,
      purpose: "construct",
      responseFormatId: ids.responseFormat,
    });
    const mIncorrect = await makeKeyedItem({
      label: "M-Incorrect",
      constructId: ids.constructMatrix,
      familyId: ids.familyMatrix,
      purpose: "construct",
      responseFormatId: ids.responseFormat,
    });
    const mOmitted = await makeKeyedItem({
      label: "M-Omitted",
      constructId: ids.constructMatrix,
      familyId: ids.familyMatrix,
      purpose: "construct",
      responseFormatId: ids.responseFormat,
    });
    const mPractice = await makeKeyedItem({
      label: "M-Practice",
      constructId: ids.constructMatrix,
      familyId: ids.familyMatrix,
      purpose: "practice",
      responseFormatId: ids.responseFormat,
    });
    const mSeed = await makeKeyedItem({
      label: "M-Seed",
      constructId: ids.constructMatrix,
      familyId: ids.familyMatrix,
      purpose: "seed",
      responseFormatId: ids.responseFormat,
    });

    await admin.from("assessment_section_items").insert([
      { section_id: ids.sectionMatrix, item_id: mCorrect.itemId, display_order: 0 },
      { section_id: ids.sectionMatrix, item_id: mIncorrect.itemId, display_order: 1 },
      { section_id: ids.sectionMatrix, item_id: mOmitted.itemId, display_order: 2 },
      { section_id: ids.sectionMatrix, item_id: mPractice.itemId, display_order: 3 },
      { section_id: ids.sectionMatrix, item_id: mSeed.itemId, display_order: 4 },
    ]);

    // --- Deductive section items ---
    const dCorrect = await makeKeyedItem({
      label: "D-Correct",
      constructId: ids.constructDeductive,
      familyId: ids.familyDeductive,
      purpose: "construct",
      responseFormatId: ids.responseFormat,
    });
    const dGap = await makeKeyedItem({
      label: "D-Gap",
      constructId: ids.constructDeductive,
      familyId: ids.familyDeductive,
      purpose: "construct",
      responseFormatId: ids.responseFormat,
    });
    const dIncorrect = await makeKeyedItem({
      label: "D-Incorrect",
      constructId: ids.constructDeductive,
      familyId: ids.familyDeductive,
      purpose: "construct",
      responseFormatId: ids.responseFormat,
    });
    const dNeverSeen = await makeKeyedItem({
      label: "D-NeverSeen",
      constructId: ids.constructDeductive,
      familyId: ids.familyDeductive,
      purpose: "construct",
      responseFormatId: ids.responseFormat,
    });

    await admin.from("assessment_section_items").insert([
      { section_id: ids.sectionDeductive, item_id: dCorrect.itemId, display_order: 0 },
      { section_id: ids.sectionDeductive, item_id: dGap.itemId, display_order: 1 },
      { section_id: ids.sectionDeductive, item_id: dIncorrect.itemId, display_order: 2 },
      { section_id: ids.sectionDeductive, item_id: dNeverSeen.itemId, display_order: 3 },
    ]);

    ids.items = {
      mCorrect: mCorrect.itemId,
      mIncorrect: mIncorrect.itemId,
      mOmitted: mOmitted.itemId,
      mPractice: mPractice.itemId,
      mSeed: mSeed.itemId,
      dCorrect: dCorrect.itemId,
      dGap: dGap.itemId,
      dIncorrect: dIncorrect.itemId,
      dNeverSeen: dNeverSeen.itemId,
    };
    ids.options = {
      mCorrect: { correct: mCorrect.correctOptionId, wrong: mCorrect.wrongOptionId },
      mIncorrect: { correct: mIncorrect.correctOptionId, wrong: mIncorrect.wrongOptionId },
      mPractice: { correct: mPractice.correctOptionId, wrong: mPractice.wrongOptionId },
      mSeed: { correct: mSeed.correctOptionId, wrong: mSeed.wrongOptionId },
      dCorrect: { correct: dCorrect.correctOptionId, wrong: dCorrect.wrongOptionId },
      dIncorrect: { correct: dIncorrect.correctOptionId, wrong: dIncorrect.wrongOptionId },
    };

    ids.session = await ins("participant_sessions", {
      assessment_id: ids.assessment,
      status: "completed",
    });

    // Deductive section: timed and already expired/finalised.
    const sectionStart = new Date(Date.now() - 100_000);
    const deadline = new Date(Date.now() - 50_000);
    const finalisedAt = new Date(Date.now() - 40_000);
    await admin.from("participant_section_states").insert({
      session_id: ids.session,
      section_id: ids.sectionDeductive,
      started_at: sectionStart.toISOString(),
      base_limit_seconds: 60,
      deadline_at: deadline.toISOString(),
      finalised_at: finalisedAt.toISOString(),
      finalised_by: "client_timer",
    });

    // --- Matrix responses ---
    const mCorrectAnsweredAt = new Date();
    await admin.from("participant_responses").insert({
      session_id: ids.session,
      item_id: ids.items.mCorrect,
      section_id: ids.sectionMatrix,
      response_value: 1, // correct option's value
      response_time_ms: 500,
      answered_at: mCorrectAnsweredAt.toISOString(),
    });
    const mIncorrectAnsweredAt = new Date(mCorrectAnsweredAt.getTime() + 2000);
    await admin.from("participant_responses").insert({
      session_id: ids.session,
      item_id: ids.items.mIncorrect,
      section_id: ids.sectionMatrix,
      response_value: 2, // wrong option's value
      response_time_ms: 8000, // deliberately misleading — must be ignored once a server anchor exists
      answered_at: mIncorrectAnsweredAt.toISOString(),
    });
    // mOmitted: no response.
    // mPractice/mSeed get explicit, later timestamps too — deliberately kept
    // OUT of the mCorrect/mIncorrect chronological window so they cannot
    // perturb the deterministic latency gap the test asserts on below (they
    // are excluded from scoring either way, so their own latency is not
    // asserted, but the chronological ordering feeds a shared per-section
    // "previous event" pointer).
    await admin.from("participant_responses").insert({
      session_id: ids.session,
      item_id: ids.items.mPractice,
      section_id: ids.sectionMatrix,
      response_value: 1,
      answered_at: new Date(mIncorrectAnsweredAt.getTime() + 1000).toISOString(),
    });
    await admin.from("participant_responses").insert({
      session_id: ids.session,
      item_id: ids.items.mSeed,
      section_id: ids.sectionMatrix,
      response_value: 1, // correct
      answered_at: new Date(mIncorrectAnsweredAt.getTime() + 2000).toISOString(),
    });

    // --- Deductive responses ---
    const dCorrectAnsweredAt = new Date(sectionStart.getTime() + 6000);
    await admin.from("participant_responses").insert({
      session_id: ids.session,
      item_id: ids.items.dCorrect,
      section_id: ids.sectionDeductive,
      response_value: 1, // correct
      answered_at: dCorrectAnsweredAt.toISOString(),
    });
    // dGap: no response.
    const dIncorrectAnsweredAt = new Date(dCorrectAnsweredAt.getTime() + 1000);
    await admin.from("participant_responses").insert({
      session_id: ids.session,
      item_id: ids.items.dIncorrect,
      section_id: ids.sectionDeductive,
      response_value: 2, // wrong
      answered_at: dIncorrectAnsweredAt.toISOString(),
    });
    // dNeverSeen: no response.
  }, 90_000);

  afterAll(async () => {
    if (!canRun) return;
    await admin.from("participant_session_flags").delete().eq("session_id", ids.session);
    await admin.from("participant_item_outcomes").delete().eq("session_id", ids.session);
    await admin.from("participant_scores").delete().eq("session_id", ids.session);
    await admin.from("participant_section_states").delete().eq("session_id", ids.session);
    await admin.from("participant_section_forms").delete().eq("session_id", ids.session);
    await admin.from("participant_responses").delete().eq("session_id", ids.session);
    await admin.from("participant_sessions").delete().eq("id", ids.session);
    await admin.from("assessment_section_items").delete().in("section_id", [ids.sectionMatrix, ids.sectionDeductive]);
    await admin.from("assessment_sections").delete().in("id", [ids.sectionMatrix, ids.sectionDeductive]);
    const itemIds = Object.values(ids.items).filter(Boolean);
    await admin.from("item_answer_keys").delete().in("item_id", itemIds);
    await admin.from("item_options").delete().in("item_id", itemIds);
    await admin.from("items").delete().in("id", itemIds);
    await admin.from("item_families").delete().in("id", [ids.familyMatrix, ids.familyDeductive]);
    await admin.from("assessment_factors").delete().eq("assessment_id", ids.assessment);
    await admin.from("factor_constructs").delete().in("factor_id", [ids.factorMatrix, ids.factorDeductive]);
    await admin.from("constructs").delete().in("id", [ids.constructMatrix, ids.constructDeductive]);
    await admin.from("factors").delete().in("id", [ids.factorMatrix, ids.factorDeductive]);
    await admin.from("assessments").delete().eq("id", ids.assessment);
    await admin.from("response_formats").delete().eq("id", ids.responseFormat);
  }, 60_000);

  it("classifies every outcome, scores per factor, and computes the composite", async () => {
    const result = await scoreSessionAbility(ids.session);
    expect(result).toEqual({ success: true, scoreCount: 2 });

    const { data: outcomes, error: outcomesErr } = await admin
      .from("participant_item_outcomes")
      .select("item_id, outcome, counts_toward_score, rapid_guess, latency_source, response_time_ms")
      .eq("session_id", ids.session);
    expect(outcomesErr).toBeNull();
    const byItem = new Map((outcomes ?? []).map((o) => [o.item_id, o]));

    // Matrix section.
    expect(byItem.get(ids.items.mCorrect)).toMatchObject({
      outcome: "correct",
      counts_toward_score: true,
      rapid_guess: true,
      latency_source: "client_fallback",
      response_time_ms: 500,
    });
    expect(byItem.get(ids.items.mIncorrect)).toMatchObject({
      outcome: "incorrect",
      counts_toward_score: true,
      rapid_guess: true, // server_gap (2000ms) overrides the misleading client 8000ms value
      latency_source: "server_gap",
      response_time_ms: 2000,
    });
    expect(byItem.get(ids.items.mOmitted)).toMatchObject({
      outcome: "omitted",
      counts_toward_score: true,
      rapid_guess: false,
      latency_source: "none",
    });
    expect(byItem.get(ids.items.mPractice)).toMatchObject({
      outcome: "excluded",
      counts_toward_score: false,
    });
    expect(byItem.get(ids.items.mSeed)).toMatchObject({
      outcome: "correct",
      counts_toward_score: false, // seed: scored, but never counted
    });

    // Deductive section — not-reached vs omitted distinction.
    expect(byItem.get(ids.items.dCorrect)).toMatchObject({
      outcome: "correct",
      counts_toward_score: true,
      rapid_guess: false, // 6000ms clears the 4000ms deductive floor
      latency_source: "server_gap",
      response_time_ms: 6000,
    });
    expect(byItem.get(ids.items.dGap)).toMatchObject({
      outcome: "omitted", // seen (below the high-water mark set by dIncorrect) but skipped
      counts_toward_score: true,
    });
    expect(byItem.get(ids.items.dIncorrect)).toMatchObject({
      outcome: "incorrect",
      counts_toward_score: true,
      rapid_guess: true,
      latency_source: "server_gap",
      response_time_ms: 1000,
    });
    expect(byItem.get(ids.items.dNeverSeen)).toMatchObject({
      outcome: "expired_unseen", // past the high-water mark -> never reached
      counts_toward_score: true,
    });
    // The core distinction this issue calls out: omitted and expired_unseen
    // are never conflated, even within the same expired section.
    expect(byItem.get(ids.items.dGap)?.outcome).not.toBe(byItem.get(ids.items.dNeverSeen)?.outcome);

    const { data: scores, error: scoresErr } = await admin
      .from("participant_scores")
      .select(
        "factor_id, raw_score, scaled_score, metric, scoring_method, scoring_variant, raw_correct, items_used, items_attempted, provisional, percentile, norm_group_id",
      )
      .eq("session_id", ids.session);
    expect(scoresErr).toBeNull();
    const byFactor = new Map((scores ?? []).map((s) => [s.factor_id, s]));

    const matrixScore = byFactor.get(ids.factorMatrix)!;
    expect(matrixScore.raw_correct).toBe(1);
    expect(matrixScore.items_used).toBe(3);
    expect(matrixScore.items_attempted).toBe(2);
    expect(Number(matrixScore.scaled_score)).toBeCloseTo(100 / 3, 6);
    expect(matrixScore.metric).toBe("percent_correct");
    expect(matrixScore.scoring_method).toBe("ctt");
    expect(matrixScore.scoring_variant).toBe("sum_correct");
    expect(matrixScore.provisional).toBe(true);
    // The claims ladder: no percentile or norm group exists yet.
    expect(matrixScore.percentile).toBeNull();
    expect(matrixScore.norm_group_id).toBeNull();

    const deductiveScore = byFactor.get(ids.factorDeductive)!;
    expect(deductiveScore.raw_correct).toBe(1);
    expect(deductiveScore.items_used).toBe(4);
    expect(deductiveScore.items_attempted).toBe(2);
    expect(Number(deductiveScore.scaled_score)).toBe(25);

    const { data: session } = await admin
      .from("participant_sessions")
      .select("composite_score, composite_method")
      .eq("id", ids.session)
      .single();
    expect(Number(session!.composite_score)).toBeCloseTo((100 / 3 + 25) / 2, 6);
    expect(session!.composite_method).toBe("mean_of_children");

    const { data: flags, error: flagsErr } = await admin
      .from("participant_session_flags")
      .select("flag_code, tier, detail")
      .eq("session_id", ids.session);
    expect(flagsErr).toBeNull();
    expect(flags).toHaveLength(1);
    expect(flags![0].flag_code).toBe("rapid_guess_rate");
    expect(flags![0].tier).toBe("blocking");
    expect(flags![0].detail.itemsUsed).toBe(7);
    expect(flags![0].detail.rte).toBeCloseTo(1 / 7, 6);
  });

  it("re-scoring the same session is idempotent (upsert, not duplicate rows)", async () => {
    const first = await scoreSessionAbility(ids.session);
    const second = await scoreSessionAbility(ids.session);
    expect(first).toEqual({ success: true, scoreCount: 2 });
    expect(second).toEqual({ success: true, scoreCount: 2 });

    const { data: scores } = await admin
      .from("participant_scores")
      .select("factor_id")
      .eq("session_id", ids.session);
    expect(scores).toHaveLength(2);

    const { data: outcomes } = await admin
      .from("participant_item_outcomes")
      .select("item_id")
      .eq("session_id", ids.session);
    expect(outcomes).toHaveLength(9);
  });
});

describe.skipIf(!canRun)("scoring: scoreSessionAbility aborts rather than mis-scores", () => {
  const admin = createAdminClient();

  const ids = {
    responseFormat: "",
    assessment: "",
    factor: "",
    construct: "",
    section: "",
    item: "",
    session: "",
  };

  async function ins(table: string, row: Record<string, unknown>): Promise<string> {
    const { data, error } = await admin.from(table).insert(row).select("id").single();
    if (error) throw new Error(`${table} insert: ${error.message}`);
    return data!.id as string;
  }

  beforeAll(async () => {
    if (!canRun) return;
    ids.responseFormat = await ins("response_formats", {
      name: `ABS Missing-Key Format ${ts}`,
      type: "cognitive",
      config: {},
    });
    ids.assessment = await ins("assessments", {
      title: `ABS Missing-Key Assessment ${ts}`,
      slug: slug("missing-key-assessment"),
      scoring_profile: "ability_dichotomous",
    });
    ids.factor = await ins("factors", { name: `ABS Missing-Key Factor ${ts}`, slug: slug("missing-key-factor") });
    ids.construct = await ins("constructs", {
      name: `ABS Missing-Key Construct ${ts}`,
      slug: slug("missing-key-construct"),
    });
    await admin
      .from("factor_constructs")
      .insert({ factor_id: ids.factor, construct_id: ids.construct, weight: 1.0 });
    await admin.from("assessment_factors").insert({ assessment_id: ids.assessment, factor_id: ids.factor });
    ids.section = await ins("assessment_sections", {
      assessment_id: ids.assessment,
      response_format_id: ids.responseFormat,
      title: "No Key",
      item_ordering: "fixed",
    });
    ids.item = await ins("items", {
      response_format_id: ids.responseFormat,
      stem: `No-key item ${ts}`,
      construct_id: ids.construct,
      purpose: "construct",
      status: "active",
    });
    await admin.from("item_options").insert([
      { item_id: ids.item, label: "A", value: 1, display_order: 0 },
      { item_id: ids.item, label: "B", value: 2, display_order: 1 },
    ]);
    // Deliberately NO item_answer_keys row for this item.
    await admin.from("assessment_section_items").insert({
      section_id: ids.section,
      item_id: ids.item,
      display_order: 0,
    });
    ids.session = await ins("participant_sessions", { assessment_id: ids.assessment, status: "completed" });
    await admin.from("participant_responses").insert({
      session_id: ids.session,
      item_id: ids.item,
      section_id: ids.section,
      response_value: 1,
      answered_at: new Date().toISOString(),
    });
  }, 60_000);

  afterAll(async () => {
    if (!canRun) return;
    await admin.from("participant_item_outcomes").delete().eq("session_id", ids.session);
    await admin.from("participant_scores").delete().eq("session_id", ids.session);
    await admin.from("participant_section_forms").delete().eq("session_id", ids.session);
    await admin.from("participant_responses").delete().eq("session_id", ids.session);
    await admin.from("participant_sessions").delete().eq("id", ids.session);
    await admin.from("assessment_section_items").delete().eq("section_id", ids.section);
    await admin.from("assessment_sections").delete().eq("id", ids.section);
    await admin.from("item_options").delete().eq("item_id", ids.item);
    await admin.from("items").delete().eq("id", ids.item);
    await admin.from("assessment_factors").delete().eq("assessment_id", ids.assessment);
    await admin.from("factor_constructs").delete().eq("factor_id", ids.factor);
    await admin.from("constructs").delete().eq("id", ids.construct);
    await admin.from("factors").delete().eq("id", ids.factor);
    await admin.from("assessments").delete().eq("id", ids.assessment);
    await admin.from("response_formats").delete().eq("id", ids.responseFormat);
  }, 60_000);

  it("aborts scoring, and writes NOTHING, when a scored item has no answer key", async () => {
    const result = await scoreSessionAbility(ids.session);
    expect(result).toHaveProperty("error");
    if ("error" in result) {
      expect(result.error).toMatch(/missing item_answer_keys/i);
    }

    const { data: scores } = await admin.from("participant_scores").select("id").eq("session_id", ids.session);
    expect(scores).toHaveLength(0);
    const { data: outcomes } = await admin
      .from("participant_item_outcomes")
      .select("item_id")
      .eq("session_id", ids.session);
    expect(outcomes).toHaveLength(0);
  });
});
