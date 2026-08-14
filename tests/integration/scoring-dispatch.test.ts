/**
 * scoreSession dispatcher (LR-5, #335): routes on assessments.scoring_profile.
 *
 * The hard regression gate for this issue: every assessment defaults to
 * scoring_profile = 'pomp_factor' (20260813104000_cognitive_scoring.sql), so
 * an assessment that never sets the column must route to the EXISTING
 * scoreSessionCTT and score identically to before this issue landed.
 * ability_dichotomous must route to the new scoreSessionAbility.
 *
 * Requires a running local Supabase instance — see
 * tests/integration/_helpers/rls-fixture.ts and
 * tests/architecture/integration-host-guard.test.ts. Run with
 * `npm run test:integration:local`.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";
import { scoreSession } from "@/lib/scoring/dispatch";

const ts = Date.now();
const slug = (s: string) => `sdp-${s}-${ts}`.toLowerCase();

describe.skipIf(!canRun)("scoring: scoreSession dispatcher", () => {
  const admin = createAdminClient();

  async function ins(table: string, row: Record<string, unknown>): Promise<string> {
    const { data, error } = await admin.from(table).insert(row).select("id").single();
    if (error) throw new Error(`${table} insert: ${error.message}`);
    return data!.id as string;
  }

  describe("scoring_profile = 'pomp_factor' (default, every pre-existing assessment)", () => {
    const ids = { format: "", assessment: "", factor: "", construct: "", item: "", session: "" };

    beforeAll(async () => {
      if (!canRun) return;
      ids.format = await ins("response_formats", { name: `SDP Likert ${ts}`, type: "likert", config: {} });
      // No scoring_profile passed -> the column's own DEFAULT 'pomp_factor' applies.
      ids.assessment = await ins("assessments", { title: `SDP POMP Assessment ${ts}`, slug: slug("pomp-assessment") });
      ids.factor = await ins("factors", { name: `SDP POMP Factor ${ts}`, slug: slug("pomp-factor") });
      ids.construct = await ins("constructs", { name: `SDP POMP Construct ${ts}`, slug: slug("pomp-construct") });
      await admin.from("factor_constructs").insert({ factor_id: ids.factor, construct_id: ids.construct, weight: 1.0 });
      await admin.from("assessment_factors").insert({ assessment_id: ids.assessment, factor_id: ids.factor });
      ids.item = await ins("items", {
        response_format_id: ids.format,
        stem: `SDP Likert item ${ts}`,
        construct_id: ids.construct,
        status: "active",
      });
      ids.session = await ins("participant_sessions", { assessment_id: ids.assessment, status: "completed" });
      await admin.from("participant_responses").insert({
        session_id: ids.session,
        item_id: ids.item,
        response_value: 4, // Likert 1-5 default bounds -> POMP 75
      });
    }, 60_000);

    afterAll(async () => {
      if (!canRun) return;
      await admin.from("participant_scores").delete().eq("session_id", ids.session);
      await admin.from("participant_responses").delete().eq("session_id", ids.session);
      await admin.from("participant_sessions").delete().eq("id", ids.session);
      await admin.from("items").delete().eq("id", ids.item);
      await admin.from("assessment_factors").delete().eq("assessment_id", ids.assessment);
      await admin.from("factor_constructs").delete().eq("factor_id", ids.factor);
      await admin.from("constructs").delete().eq("id", ids.construct);
      await admin.from("factors").delete().eq("id", ids.factor);
      await admin.from("assessments").delete().eq("id", ids.assessment);
      await admin.from("response_formats").delete().eq("id", ids.format);
    }, 60_000);

    it("routes to scoreSessionCTT (mean POMP) — the existing, unchanged behaviour", async () => {
      const result = await scoreSession(ids.session);
      expect(result).toEqual({ success: true, scoreCount: 1 });

      const { data: scores } = await admin
        .from("participant_scores")
        .select("scaled_score, scoring_method, metric")
        .eq("session_id", ids.session);
      expect(scores).toHaveLength(1);
      expect(Number(scores![0].scaled_score)).toBe(75);
      expect(scores![0].scoring_method).toBe("ctt");
      // pomp_factor rows never touch the new columns' non-default values.
      expect(scores![0].metric).toBe("pomp");

      // No per-item outcome/effort artefacts for a POMP-scored session — that
      // machinery belongs to the ability scorer only.
      const { data: outcomes } = await admin
        .from("participant_item_outcomes")
        .select("item_id")
        .eq("session_id", ids.session);
      expect(outcomes).toHaveLength(0);
    });
  });

  describe("scoring_profile = 'ability_dichotomous'", () => {
    const ids = {
      format: "",
      assessment: "",
      factor: "",
      construct: "",
      section: "",
      item: "",
      correctOption: "",
      session: "",
    };

    beforeAll(async () => {
      if (!canRun) return;
      ids.format = await ins("response_formats", { name: `SDP Cognitive ${ts}`, type: "cognitive", config: {} });
      ids.assessment = await ins("assessments", {
        title: `SDP Ability Assessment ${ts}`,
        slug: slug("ability-assessment"),
        scoring_profile: "ability_dichotomous",
      });
      ids.factor = await ins("factors", { name: `SDP Ability Factor ${ts}`, slug: slug("ability-factor") });
      ids.construct = await ins("constructs", { name: `SDP Ability Construct ${ts}`, slug: slug("ability-construct") });
      await admin.from("factor_constructs").insert({ factor_id: ids.factor, construct_id: ids.construct, weight: 1.0 });
      await admin.from("assessment_factors").insert({ assessment_id: ids.assessment, factor_id: ids.factor });
      ids.section = await ins("assessment_sections", {
        assessment_id: ids.assessment,
        response_format_id: ids.format,
        title: "Ability",
        item_ordering: "fixed",
      });
      ids.item = await ins("items", {
        response_format_id: ids.format,
        stem: `SDP ability item ${ts}`,
        construct_id: ids.construct,
        purpose: "construct",
        status: "active",
      });
      ids.correctOption = await ins("item_options", { item_id: ids.item, label: "Correct", value: 1, display_order: 0 });
      await admin.from("item_options").insert({ item_id: ids.item, label: "Wrong", value: 2, display_order: 1 });
      await admin.from("item_answer_keys").insert({ item_id: ids.item, correct_option_id: ids.correctOption });
      await admin.from("assessment_section_items").insert({ section_id: ids.section, item_id: ids.item, display_order: 0 });
      ids.session = await ins("participant_sessions", { assessment_id: ids.assessment, status: "completed" });
      await admin.from("participant_responses").insert({
        session_id: ids.session,
        item_id: ids.item,
        section_id: ids.section,
        response_value: 1, // correct option's value
        answered_at: new Date().toISOString(),
      });
    }, 60_000);

    afterAll(async () => {
      if (!canRun) return;
      await admin.from("participant_session_flags").delete().eq("session_id", ids.session);
      await admin.from("participant_item_outcomes").delete().eq("session_id", ids.session);
      await admin.from("participant_scores").delete().eq("session_id", ids.session);
      await admin.from("participant_section_forms").delete().eq("session_id", ids.session);
      await admin.from("participant_responses").delete().eq("session_id", ids.session);
      await admin.from("participant_sessions").delete().eq("id", ids.session);
      await admin.from("assessment_section_items").delete().eq("section_id", ids.section);
      await admin.from("assessment_sections").delete().eq("id", ids.section);
      await admin.from("item_answer_keys").delete().eq("item_id", ids.item);
      await admin.from("item_options").delete().eq("item_id", ids.item);
      await admin.from("items").delete().eq("id", ids.item);
      await admin.from("assessment_factors").delete().eq("assessment_id", ids.assessment);
      await admin.from("factor_constructs").delete().eq("factor_id", ids.factor);
      await admin.from("constructs").delete().eq("id", ids.construct);
      await admin.from("factors").delete().eq("id", ids.factor);
      await admin.from("assessments").delete().eq("id", ids.assessment);
      await admin.from("response_formats").delete().eq("id", ids.format);
    }, 60_000);

    it("routes to scoreSessionAbility (sum-correct)", async () => {
      const result = await scoreSession(ids.session);
      expect(result).toEqual({ success: true, scoreCount: 1 });

      const { data: scores } = await admin
        .from("participant_scores")
        .select("scaled_score, raw_correct, metric, scoring_variant, provisional")
        .eq("session_id", ids.session);
      expect(scores).toHaveLength(1);
      expect(Number(scores![0].scaled_score)).toBe(100);
      expect(scores![0].raw_correct).toBe(1);
      expect(scores![0].metric).toBe("percent_correct");
      expect(scores![0].scoring_variant).toBe("sum_correct");
      expect(scores![0].provisional).toBe(true);

      const { data: outcomes } = await admin
        .from("participant_item_outcomes")
        .select("outcome")
        .eq("session_id", ids.session);
      expect(outcomes).toHaveLength(1);
      expect(outcomes![0].outcome).toBe("correct");
    });
  });
});
