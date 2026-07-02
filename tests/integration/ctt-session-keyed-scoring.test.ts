import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";
import { scoreSessionCTT } from "@/lib/scoring/ctt-session";

const ts = Date.now();
const slug = (s: string) => `cks-${s}-${ts}`.toLowerCase();

/**
 * End-to-end test for option-level keyed scoring (scoreSessionCTT).
 *
 * Items whose options carry score_value are expert-keyed: the participant's
 * POMP is their chosen option's key scaled across the item's non-excluded key
 * range (keys 0/1/3/5 → 0/20/60/100). Options flagged exclude_from_scoring
 * ("Don't know") drop the response from aggregates entirely — the factor gets
 * no score row rather than a fabricated 0.
 *
 * Seven factors, one SJT-style item each:
 *   Keyed items (options 1–4 keyed 0/1/3/5):
 *   - factorBest:  chose the key-5 option   → 100 POMP
 *   - factorWorst: chose the key-0 option   → 0 POMP
 *   - factorMid:   chose the key-3 option   → 60 POMP
 *   - factorRev:   item is reverse_scored but KEYED — keys are authoritative,
 *                  so choosing the key-5 option still scores 100 (the raw
 *                  reversed path would have produced 0)
 *   - factorDk:    chose the excluded "Don't know" option → no score row
 *   Unkeyed items (options 1–4 with no keys, plus an excluded value-9 option):
 *   - factorRawDk:     chose the excluded option → no score row even without keys
 *   - factorRawBounds: chose 4 → 100 POMP — the excluded option's sentinel
 *                      value 9 must not stretch the raw bounds (a stretched
 *                      1–9 scale would have scored 37.5)
 */
describe.skipIf(!canRun)("scoring: scoreSessionCTT keyed options", () => {
  const admin = createAdminClient();

  const KEYS = ["Best", "Worst", "Mid", "Rev", "Dk", "RawDk", "RawBounds"] as const;
  type Key = (typeof KEYS)[number];

  const ids = {
    client: "",
    campaign: "",
    assessment: "",
    participant: "",
    session: "",
    format: "",
    factor: {} as Record<Key, string>,
    construct: {} as Record<Key, string>,
    item: {} as Record<Key, string>,
  };

  const ins = async (
    table: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    row: Record<string, any>,
  ): Promise<string> => {
    const { data, error } = await admin
      .from(table)
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(`${table} insert: ${error.message}`);
    return data!.id as string;
  };

  beforeAll(async () => {
    ids.client = await ins("clients", {
      name: `CKS Client ${ts}`,
      slug: slug("client"),
    });
    ids.campaign = await ins("campaigns", {
      title: `CKS Campaign ${ts}`,
      slug: slug("campaign"),
      client_id: ids.client,
    });
    ids.assessment = await ins("assessments", {
      title: `CKS Assessment ${ts}`,
      slug: slug("assessment"),
    });
    ids.format = await ins("response_formats", {
      name: `CKS SJT ${ts}`,
      type: "sjt",
      config: { scenarioCount: 4, scoringMethod: "expert" },
    });

    for (const key of KEYS) {
      const factorId = await ins("factors", {
        name: `CKS Factor ${key} ${ts}`,
        slug: slug(`factor-${key}`),
      });
      const constructId = await ins("constructs", {
        name: `CKS Construct ${key} ${ts}`,
        slug: slug(`construct-${key}`),
      });
      await ins("factor_constructs", {
        factor_id: factorId,
        construct_id: constructId,
        weight: 1.0,
      });
      await ins("assessment_factors", {
        assessment_id: ids.assessment,
        factor_id: factorId,
      });
      const itemId = await ins("items", {
        response_format_id: ids.format,
        stem: `CKS keyed item ${key} ${ts}`,
        construct_id: constructId,
        reverse_scored: key === "Rev",
        status: "active",
      });

      // Four options valued 1–4: expert keys 0/1/3/5 for keyed items, no
      // keys for the Raw* items (they score by raw response value).
      const isRawItem = key === "RawDk" || key === "RawBounds";
      const keyedOptions: [string, number, number | null][] = [
        ["Least effective", 1, isRawItem ? null : 0],
        ["Weak", 2, isRawItem ? null : 1],
        ["Good", 3, isRawItem ? null : 3],
        ["Most effective", 4, isRawItem ? null : 5],
      ];
      for (const [label, value, scoreValue] of keyedOptions) {
        await ins("item_options", {
          item_id: itemId,
          label,
          value,
          score_value: scoreValue,
          display_order: value,
        });
      }
      // These items also offer an excluded "Don't know" option whose
      // sentinel value must never define the scoring scale.
      if (key === "Dk" || isRawItem) {
        await ins("item_options", {
          item_id: itemId,
          label: "Don't know",
          value: 9,
          score_value: null,
          exclude_from_scoring: true,
          display_order: 9,
        });
      }

      ids.factor[key] = factorId;
      ids.construct[key] = constructId;
      ids.item[key] = itemId;
    }

    ids.participant = await ins("campaign_participants", {
      campaign_id: ids.campaign,
      email: `cks-${ts}@test.local`,
      first_name: "Key",
    });
    ids.session = await ins("participant_sessions", {
      campaign_participant_id: ids.participant,
      campaign_id: ids.campaign,
      assessment_id: ids.assessment,
      client_id: ids.client,
      status: "completed",
    });

    const responses: [Key, number][] = [
      ["Best", 4], // key 5 → 100
      ["Worst", 1], // key 0 → 0
      ["Mid", 3], // key 3 → 60
      ["Rev", 4], // key 5 → 100 (reverse_scored must NOT apply)
      ["Dk", 9], // excluded → dropped
      ["RawDk", 9], // excluded on an UNKEYED item → dropped
      ["RawBounds", 4], // raw bounds 1–4 (excluded 9 must not stretch) → 100
    ];
    for (const [key, value] of responses) {
      await ins("participant_responses", {
        session_id: ids.session,
        item_id: ids.item[key],
        response_value: value,
      });
    }
  });

  afterAll(async () => {
    await admin.from("participant_scores").delete().eq("session_id", ids.session);
    await admin
      .from("participant_responses")
      .delete()
      .eq("session_id", ids.session);
    await admin.from("participant_sessions").delete().eq("id", ids.session);
    await admin.from("campaign_participants").delete().eq("id", ids.participant);
    await admin
      .from("items")
      .delete()
      .in("id", Object.values(ids.item).filter(Boolean));
    await admin.from("response_formats").delete().eq("id", ids.format);
    await admin.from("assessments").delete().eq("id", ids.assessment);
    await admin
      .from("factors")
      .delete()
      .in("id", Object.values(ids.factor).filter(Boolean));
    await admin
      .from("constructs")
      .delete()
      .in("id", Object.values(ids.construct).filter(Boolean));
    await admin.from("campaigns").delete().eq("id", ids.campaign);
    await admin.from("clients").delete().eq("id", ids.client);
  });

  it("scores keyed items by option key and drops excluded responses", async () => {
    const result = await scoreSessionCTT(ids.session);
    // Dk and RawDk factors' only responses are excluded → five factors score.
    expect(result).toEqual({ success: true, scoreCount: 5 });

    const { data: scores, error } = await admin
      .from("participant_scores")
      .select("factor_id, raw_score, scaled_score")
      .eq("session_id", ids.session);
    expect(error).toBeNull();
    expect(scores).toHaveLength(5);

    const byFactor = new Map(
      (scores ?? []).map((s) => [s.factor_id, Number(s.scaled_score)]),
    );
    expect(byFactor.get(ids.factor.Best)).toBe(100);
    expect(byFactor.get(ids.factor.Worst)).toBe(0);
    expect(byFactor.get(ids.factor.Mid)).toBe(60);
    // Keys are authoritative: raw reversed scoring would have produced 0.
    expect(byFactor.get(ids.factor.Rev)).toBe(100);
    // Excluded response → no score row at all, not a zero — keyed or not.
    expect(byFactor.has(ids.factor.Dk)).toBe(false);
    expect(byFactor.has(ids.factor.RawDk)).toBe(false);
    // Excluded option's sentinel value must not stretch raw bounds:
    // response 4 on options 1–4 is 100, not (4-1)/(9-1) = 37.5.
    expect(byFactor.get(ids.factor.RawBounds)).toBe(100);

    // Composite = mean of scored factors = (100 + 0 + 60 + 100 + 100) / 5.
    const { data: session } = await admin
      .from("participant_sessions")
      .select("composite_score")
      .eq("id", ids.session)
      .single();
    expect(Number(session!.composite_score)).toBe(72);
  });
});
