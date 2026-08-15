/**
 * Cognitive item delivery (LR-4, #334): the full `getSessionState` payload
 * for a session with a `cognitive`-typed section must carry the rendered
 * grid/option SVGs and MUST NOT carry any key material — doc
 * docs/superpowers/specs/2026-08-13-logical-reasoning-build-plan/
 * 02-platform-architecture.md §2.6.
 *
 * Requires a running local Supabase instance — see
 * tests/integration/_helpers/rls-fixture.ts and
 * tests/architecture/integration-host-guard.test.ts. Run with
 * `npm run test:integration:local`.
 *
 * Seeds a real `item_answer_keys` row and real `item_option_diagnostics`
 * rows carrying distinctive marker strings, then asserts those markers never
 * appear anywhere in `JSON.stringify(getSessionState(...))` — a
 * content-based assertion, not just a structural one, so a future accidental
 * `select('*')` or object-spread leak would fail this test even if it didn't
 * fail the narrower architecture-test regexes in
 * tests/architecture/answer-key-isolation.test.ts.
 *
 * LR-3 / #333 note: getSessionState now freezes each session's delivered
 * item set on first read (participant_section_forms). The "falls back to a
 * plain item" test below therefore uses its OWN fresh session rather than
 * the shared `ids.session` the first test already read — a session that has
 * already been read has an already-frozen form and, correctly, will not
 * pick up an item added to the section afterwards.
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";
import { m6ItemSpec, m6OptionSpecs } from "../fixtures/cognitive/m6";

const ts = Date.now();
const testSlug = (label: string) => `csp-${label}-${ts}`;

const SECRET_RATIONALE = `SECRET-RATIONALE-DO-NOT-LEAK-${ts}`;
const SECRET_DIAGNOSTIC = `SECRET-DIAGNOSTIC-DO-NOT-LEAK-${ts}`;

describe.skipIf(!canRun)("cognitive item delivery — getSessionState payload", () => {
  const adminDb = createAdminClient();
  const token = randomBytes(32).toString("hex");

  const ids = {
    partner: "",
    client: "",
    responseFormat: "",
    assessment: "",
    section: "",
    construct: "",
    family: "",
    item: "",
    optionIds: {} as Record<"A" | "B" | "C" | "D" | "E", string>,
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

    ids.partner = await insertRow("partners", { name: `CSP Partner ${ts}`, slug: testSlug("partner") });
    ids.client = await insertRow("clients", { name: `CSP Client ${ts}`, slug: testSlug("client"), partner_id: ids.partner });
    ids.responseFormat = await insertRow("response_formats", {
      name: `Cognitive ${ts}`,
      type: "cognitive",
      config: {},
    });
    ids.assessment = await insertRow("assessments", {
      title: `CSP Assessment ${ts}`,
      slug: testSlug("assessment"),
      client_id: ids.client,
      partner_id: ids.partner,
      status: "active",
    });
    ids.section = await insertRow("assessment_sections", {
      assessment_id: ids.assessment,
      response_format_id: ids.responseFormat,
      title: "Figural Matrices",
    });
    ids.construct = await insertRow("constructs", {
      name: `Figural Matrix Reasoning ${ts}`,
      slug: testSlug("construct"),
      partner_id: ids.partner,
    });
    ids.family = await insertRow("item_families", {
      code: testSlug("LRM-2R-XLAYER"),
      construct_id: ids.construct,
      kind: "figural_matrix",
    });
    ids.item = await insertRow("items", {
      response_format_id: ids.responseFormat,
      stem: "Which figure completes the pattern?",
      purpose: "construct",
      construct_id: ids.construct,
      family_id: ids.family,
    });
    await adminDb.from("assessment_section_items").insert({
      section_id: ids.section,
      item_id: ids.item,
      display_order: 0,
    });

    const slots: Array<"A" | "B" | "C" | "D" | "E"> = ["A", "B", "C", "D", "E"];
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      ids.optionIds[slot] = await insertRow("item_options", {
        item_id: ids.item,
        label: slot,
        value: i + 1,
        display_order: i,
      });
    }

    // The delivered spec — item-level (grid/rules/radicals/render) and one
    // row per option, exactly the storage split src/lib/cognitive/spec/
    // schema.ts documents.
    await adminDb.from("cognitive_item_specs").insert({
      item_id: ids.item,
      kind: "figural_matrix",
      spec: m6ItemSpec,
      content_hash: `sha256:test-${ts}`,
    });
    for (let i = 0; i < slots.length; i++) {
      await adminDb.from("cognitive_option_specs").insert({
        option_id: ids.optionIds[slots[i]],
        item_id: ids.item,
        spec: m6OptionSpecs[i],
      });
    }

    // The secure set — must never reach getSessionState's payload.
    await adminDb.from("item_answer_keys").insert({
      item_id: ids.item,
      correct_option_id: ids.optionIds.B,
      rationale: SECRET_RATIONALE,
    });
    await adminDb.from("item_option_diagnostics").insert([
      { option_id: ids.optionIds.A, item_id: ids.item, error_label: "IR", rationale: `${SECRET_DIAGNOSTIC}-A` },
      { option_id: ids.optionIds.C, item_id: ids.item, error_label: "IR", rationale: `${SECRET_DIAGNOSTIC}-C` },
      { option_id: ids.optionIds.D, item_id: ids.item, error_label: "PM", rationale: `${SECRET_DIAGNOSTIC}-D` },
      { option_id: ids.optionIds.E, item_id: ids.item, error_label: "RP", rationale: `${SECRET_DIAGNOSTIC}-E` },
    ]);

    ids.campaign = await insertRow("campaigns", {
      title: `CSP Campaign ${ts}`,
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
      email: `csp-${ts}@test.local`,
      first_name: "Cody",
      last_name: "Cognitive",
      status: "in_progress",
      access_token: token,
    });
    ids.session = await insertRow("participant_sessions", {
      assessment_id: ids.assessment,
      campaign_id: ids.campaign,
      campaign_participant_id: ids.participant,
      client_id: ids.client,
      status: "in_progress",
    });
  }, 90_000);

  afterAll(async () => {
    if (!canRun) return;
    await adminDb.from("participant_sessions").delete().eq("id", ids.session);
    await adminDb.from("campaign_participants").delete().eq("id", ids.participant);
    await adminDb.from("campaign_assessments").delete().eq("campaign_id", ids.campaign);
    await adminDb.from("campaigns").delete().eq("id", ids.campaign);
    await adminDb.from("item_option_diagnostics").delete().eq("item_id", ids.item);
    await adminDb.from("item_answer_keys").delete().eq("item_id", ids.item);
    await adminDb.from("cognitive_option_specs").delete().eq("item_id", ids.item);
    await adminDb.from("cognitive_item_specs").delete().eq("item_id", ids.item);
    await adminDb.from("assessment_section_items").delete().eq("section_id", ids.section);
    await adminDb.from("item_options").delete().eq("item_id", ids.item);
    await adminDb.from("items").delete().eq("id", ids.item);
    await adminDb.from("item_families").delete().eq("id", ids.family);
    await adminDb.from("constructs").delete().eq("id", ids.construct);
    await adminDb.from("assessment_sections").delete().eq("id", ids.section);
    await adminDb.from("assessments").delete().eq("id", ids.assessment);
    await adminDb.from("response_formats").delete().eq("id", ids.responseFormat);
    await adminDb.from("clients").delete().eq("id", ids.client);
    await adminDb.from("partners").delete().eq("id", ids.partner);
  }, 60_000);

  it("delivers a rendered stimulus and per-option SVGs, with no key material anywhere in the payload", async () => {
    const { getSessionState } = await import("@/app/actions/assess");
    const result = await getSessionState(token, ids.session);

    expect("error" in result ? result.error : undefined).toBeUndefined();
    if (!("data" in result) || !result.data) throw new Error("getSessionState returned no data");

    const section = result.data.sections.find((s) => s.id === ids.section);
    expect(section).toBeDefined();
    expect(section!.responseFormatType).toBe("cognitive");

    const item = section!.items.find((it) => it.id === ids.item);
    expect(item).toBeDefined();
    expect(item!.stimulus).toBeDefined();
    expect(item!.stimulus!.kind).toBe("figural_matrix");
    expect(item!.stimulus!.gridSvg).toContain("<svg");
    expect(item!.stimulus!.gridSvg).toContain("<polygon");
    expect(item!.stimulus!.ariaLabel.length).toBeGreaterThan(0);
    // The honest-limitation label, not a cell-by-cell description.
    expect(item!.stimulus!.ariaLabel).not.toMatch(/row 1|column 1|R1C1/i);

    expect(item!.options).toHaveLength(5);
    for (const option of item!.options) {
      expect(option.optionSvg, `option ${option.label} missing optionSvg`).toBeTruthy();
      expect(option.optionSvg).toContain("<svg");
    }

    const payload = JSON.stringify(result);

    // Content-based isolation check — the actual secret strings we seeded.
    expect(payload).not.toContain(SECRET_RATIONALE);
    expect(payload).not.toContain(SECRET_DIAGNOSTIC);

    // NOT asserted: that the correct option's id is absent from the payload.
    // It must be present — it is one of the five ids the candidate selects
    // between, and omitting it would make the item unanswerable. Its presence
    // leaks nothing, because all five ids are present and nothing marks which
    // is keyed. The property worth testing is indistinguishability, below.
    const optionIdsInPayload = Object.values(ids.optionIds);
    for (const optionId of optionIdsInPayload) {
      expect(payload, "every option id must be deliverable").toContain(optionId);
    }

    // The correct option must be shaped exactly like the distractors: same
    // fields, no extra marker, nothing sortable into "the right one". If a
    // future change adds a per-option field that is only populated for the
    // key, this fails.
    const optionShapes = item!.options.map((o) =>
      Object.keys(o as Record<string, unknown>).sort().join(","),
    );
    expect(new Set(optionShapes).size, "options differ in shape").toBe(1);

    const keyedOption = item!.options.find((o) => o.id === ids.optionIds.B);
    expect(keyedOption, "keyed option must be delivered like any other").toBeDefined();
    expect(Object.keys(keyedOption as Record<string, unknown>).sort()).toEqual(
      Object.keys(item!.options[0] as Record<string, unknown>).sort(),
    );

    // Field/token isolation check — nothing key-shaped anywhere in the payload.
    for (const forbidden of [
      "correct_option_id",
      "correctOptionId",
      "error_label",
      "errorLabel",
      "item_answer_keys",
      "item_option_diagnostics",
      "\"rules\"",
      "\"radicals\"",
      "distractorPlan",
      "isCorrect",
      "score_value",
      "scoreValue",
    ]) {
      expect(payload, `payload unexpectedly contains "${forbidden}"`).not.toContain(forbidden);
    }
  }, 30_000);

  it("falls back to a plain item (no stimulus) if the item has no cognitive spec, rather than failing the whole section", async () => {
    const bareItemId = await insertRow("items", {
      response_format_id: ids.responseFormat,
      stem: "Bare item with no cognitive spec",
      purpose: "construct",
      construct_id: ids.construct,
    });
    await adminDb.from("assessment_section_items").insert({
      section_id: ids.section,
      item_id: bareItemId,
      display_order: 1,
    });

    // A FRESH session/participant/token — not the shared `ids.session` the
    // test above already read. That session's form is now frozen (LR-3 /
    // #333: getSessionState freezes participant_section_forms on first
    // read), so it will keep delivering the same single item forever and
    // would never pick up one added to the section afterwards — that is the
    // feature working as intended, not a bug to route around. This test
    // wants a session whose FIRST-EVER read includes the bare item, so it
    // needs a session that has never been read before.
    const token2 = randomBytes(32).toString("hex");
    const participant2 = await insertRow("campaign_participants", {
      campaign_id: ids.campaign,
      email: `csp-bare-${ts}@test.local`,
      first_name: "Bare",
      last_name: "Item",
      status: "in_progress",
      access_token: token2,
    });
    const session2 = await insertRow("participant_sessions", {
      assessment_id: ids.assessment,
      campaign_id: ids.campaign,
      campaign_participant_id: participant2,
      client_id: ids.client,
      status: "in_progress",
    });

    try {
      const { getSessionState } = await import("@/app/actions/assess");
      const result = await getSessionState(token2, session2);
      if (!("data" in result) || !result.data) throw new Error("getSessionState returned no data");

      const section = result.data.sections.find((s) => s.id === ids.section);
      const bareItem = section!.items.find((it) => it.id === bareItemId);
      expect(bareItem).toBeDefined();
      expect(bareItem!.stimulus).toBeUndefined();

      // The item WITH a spec in the same section is unaffected.
      const goodItem = section!.items.find((it) => it.id === ids.item);
      expect(goodItem!.stimulus).toBeDefined();
    } finally {
      await adminDb.from("participant_sessions").delete().eq("id", session2);
      await adminDb.from("campaign_participants").delete().eq("id", participant2);
      await adminDb.from("assessment_section_items").delete().eq("item_id", bareItemId);
      await adminDb.from("items").delete().eq("id", bareItemId);
    }
  }, 30_000);
});
