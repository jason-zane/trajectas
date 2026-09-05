import { getOrCreateSectionForms } from '@/lib/dal/session-forms';
/**
 * save_responses_batch_for_session — response bounds validation (audit H12).
 *
 * The RPC rejects response values outside the item's derived bounds the same
 * way it rejects items that don't belong to the assessment: the row is not
 * saved and its item_id is absent from the returned array, so the client
 * keeps the row pending instead of silently losing it.
 *
 * Bounds ladder mirrors deriveItemBounds: item_options (non-excluded) win
 * when present; otherwise config bounds; otherwise the 1–5 Likert default.
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";

const ts = Date.now();
const testSlug = (label: string) => `sbb-${label}-${ts}`;

describe.skipIf(!canRun)("save_responses_batch_for_session bounds", () => {
  const adminDb = createAdminClient();

  const token = randomBytes(32).toString("hex");
  const ids = {
    partner: "",
    client: "",
    responseFormat: "",
    assessment: "",
    section: "",
    itemDefault: "",
    itemWithOptions: "",
    campaign: "",
    participant: "",
    session: "",
  };

  async function callRpc(saves: Array<{ itemId: string; responseValue: number }>) {
    const { data, error } = await adminDb.rpc("save_responses_batch_for_session", {
      p_access_token: token,
      p_session_id: ids.session,
      p_saves: saves.map((s) => ({
        itemId: s.itemId,
        responseValue: s.responseValue,
        responseData: {},
        responseTimeMs: null,
      })),
    });
    expect(error).toBeNull();
    // 20260818230000 changed the result to {acked, terminal}; normalise the
    // legacy array shape so each assertion states the protocol explicitly.
    if (Array.isArray(data)) return { acked: data as string[], terminal: [] as string[] };
    return data as { acked: string[]; terminal: string[] } | number;
  }

  beforeAll(async () => {
    if (!canRun) return;

    const { data: partner } = await adminDb
      .from("partners")
      .insert({ name: `SBB Partner ${ts}`, slug: testSlug("partner") })
      .select("id")
      .single();
    ids.partner = partner!.id;

    const { data: client } = await adminDb
      .from("clients")
      .insert({
        name: `SBB Client ${ts}`,
        slug: testSlug("client"),
        partner_id: ids.partner,
      })
      .select("id")
      .single();
    ids.client = client!.id;

    // No explicit bounds in config → items without options fall back to the
    // 1–5 Likert default; items with options use the option values.
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
    ids.itemDefault = await makeItem("Default-bounds item");
    ids.itemWithOptions = await makeItem("Option-bounds item");

    // 1–6 options on the second item — its bounds come from these. Plus an
    // excluded "Don't know" option whose sentinel sits outside the scored
    // scale: legitimate input, must not define the bounds but must save.
    // PostgREST bulk inserts need uniform keys across rows.
    await adminDb.from("item_options").insert([
      ...Array.from({ length: 6 }, (_, i) => ({
        item_id: ids.itemWithOptions,
        label: `Anchor ${i + 1}`,
        value: i + 1,
        display_order: i,
        exclude_from_scoring: false,
      })),
      {
        item_id: ids.itemWithOptions,
        label: "Don't know",
        value: 9,
        display_order: 6,
        exclude_from_scoring: true,
      },
    ]);

    await adminDb.from("assessment_section_items").insert([
      { section_id: ids.section, item_id: ids.itemDefault, display_order: 0 },
      { section_id: ids.section, item_id: ids.itemWithOptions, display_order: 1 },
    ]);

    const { data: campaign } = await adminDb
      .from("campaigns")
      .insert({
        title: `SBB Campaign ${ts}`,
        slug: testSlug("campaign"),
        client_id: ids.client,
        partner_id: ids.partner,
        status: "active",
      })
      .select("id")
      .single();
    ids.campaign = campaign!.id;

    // The RPC's ownership predicate requires a LIVE campaign_assessments
    // attachment for campaign sessions.
    await adminDb.from("campaign_assessments").insert({
      campaign_id: ids.campaign,
      assessment_id: ids.assessment,
      display_order: 0,
    });

    const { data: participant } = await adminDb
      .from("campaign_participants")
      .insert({
        campaign_id: ids.campaign,
        email: `sbb-${ts}@test.local`,
        first_name: "Test",
        last_name: "Bounds",
        status: "in_progress",
        access_token: token,
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
    const forms = await getOrCreateSectionForms(adminDb, { sessionId: ids.session, assessmentId: ids.assessment, campaignId: ids.campaign });
    expect('error' in forms).toBe(false);

  }, 90_000);

  afterAll(async () => {
    if (!canRun) return;
    await adminDb.from("participant_responses").delete().eq("session_id", ids.session);
    await adminDb.from("participant_sessions").delete().eq("id", ids.session);
    await adminDb.from("campaign_participants").delete().eq("id", ids.participant);
    await adminDb
      .from("campaign_assessments")
      .delete()
      .eq("campaign_id", ids.campaign);
    await adminDb.from("campaigns").delete().eq("id", ids.campaign);
    await adminDb.from("assessment_section_items").delete().eq("section_id", ids.section);
    await adminDb.from("assessment_sections").delete().eq("id", ids.section);
    await adminDb
      .from("item_options")
      .delete()
      .eq("item_id", ids.itemWithOptions);
    await adminDb
      .from("items")
      .delete()
      .in("id", [ids.itemDefault, ids.itemWithOptions]);
    await adminDb.from("assessments").delete().eq("id", ids.assessment);
    await adminDb.from("response_formats").delete().eq("id", ids.responseFormat);
    await adminDb.from("clients").delete().eq("id", ids.client);
    await adminDb.from("partners").delete().eq("id", ids.partner);
  }, 60_000);

  it("saves in-range values and returns their item ids", async () => {
    const saved = await callRpc([
      { itemId: ids.itemDefault, responseValue: 3 },
      { itemId: ids.itemWithOptions, responseValue: 6 },
    ]);
    expect(saved).toEqual({
      acked: expect.arrayContaining([ids.itemDefault, ids.itemWithOptions]),
      terminal: [],
    });
  });

  it("rejects out-of-range values without touching stored rows", async () => {
    // Out-of-range is TERMINAL under 20260818230000: the value can never
    // save, so the client is told to stop retrying it — not left to retry
    // forever behind an ack that will never come.
    const saved = await callRpc([
      { itemId: ids.itemDefault, responseValue: 999 },
      { itemId: ids.itemWithOptions, responseValue: -50 },
    ]);
    expect(saved).toEqual({
      acked: [],
      terminal: expect.arrayContaining([ids.itemDefault, ids.itemWithOptions]),
    });

    const { data: rows } = await adminDb
      .from("participant_responses")
      .select("item_id, response_value")
      .eq("session_id", ids.session)
      .order("item_id");
    // The previously saved in-range values survive untouched.
    const byItem = new Map(
      (rows ?? []).map((r) => [r.item_id, Number(r.response_value)]),
    );
    expect(byItem.get(ids.itemDefault)).toBe(3);
    expect(byItem.get(ids.itemWithOptions)).toBe(6);
  });

  it("enforces option-derived bounds above the Likert default", async () => {
    // 6 is valid for the option-bounds item (options 1–6) but out of range
    // for the default-bounds item (Likert fallback 1–5).
    const saved = await callRpc([{ itemId: ids.itemDefault, responseValue: 6 }]);
    expect(saved).toEqual({ acked: [], terminal: [ids.itemDefault] });
  });

  it("accepts an excluded option's sentinel value outside the scored scale", async () => {
    // "Don't know" = 9 is a real option the runner offers; it must save even
    // though the scored bounds are 1–6. An unlisted 8 must still be rejected.
    const saved = await callRpc([{ itemId: ids.itemWithOptions, responseValue: 9 }]);
    expect(saved).toEqual({ acked: [ids.itemWithOptions], terminal: [] });

    const rejected = await callRpc([
      { itemId: ids.itemWithOptions, responseValue: 8 },
    ]);
    expect(rejected).toEqual({ acked: [], terminal: [ids.itemWithOptions] });

    const { data: row } = await adminDb
      .from("participant_responses")
      .select("response_value")
      .eq("session_id", ids.session)
      .eq("item_id", ids.itemWithOptions)
      .single();
    expect(Number(row?.response_value)).toBe(9);
  });
});
