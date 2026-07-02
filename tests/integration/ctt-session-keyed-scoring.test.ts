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
 * Five factors, one SJT-style keyed item each (options 1–4 keyed 0/1/3/5):
 *   - factorBest:  chose the key-5 option   → 100 POMP
 *   - factorWorst: chose the key-0 option   → 0 POMP
 *   - factorMid:   chose the key-3 option   → 60 POMP
 *   - factorRev:   item is reverse_scored but KEYED — keys are authoritative,
 *                  so choosing the key-5 option still scores 100 (the raw
 *                  reversed path would have produced 0)
 *   - factorDk:    chose the excluded "Don't know" option → no score row
 */
describe.skipIf(!canRun)("scoring: scoreSessionCTT keyed options", () => {
  const admin = createAdminClient();

  const KEYS = ["Best", "Worst", "Mid", "Rev", "Dk"] as const;
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

      // Four expert-keyed options: values 1–4 with keys 0/1/3/5.
      const keyedOptions: [string, number, number][] = [
        ["Least effective", 1, 0],
        ["Weak", 2, 1],
        ["Good", 3, 3],
        ["Most effective", 4, 5],
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
      // The Dk item also offers an excluded "Don't know" option.
      if (key === "Dk") {
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
    // The Dk factor's only response is excluded, so only four factors score.
    expect(result).toEqual({ success: true, scoreCount: 4 });

    const { data: scores, error } = await admin
      .from("participant_scores")
      .select("factor_id, raw_score, scaled_score")
      .eq("session_id", ids.session);
    expect(error).toBeNull();
    expect(scores).toHaveLength(4);

    const byFactor = new Map(
      (scores ?? []).map((s) => [s.factor_id, Number(s.scaled_score)]),
    );
    expect(byFactor.get(ids.factor.Best)).toBe(100);
    expect(byFactor.get(ids.factor.Worst)).toBe(0);
    expect(byFactor.get(ids.factor.Mid)).toBe(60);
    // Keys are authoritative: raw reversed scoring would have produced 0.
    expect(byFactor.get(ids.factor.Rev)).toBe(100);
    // Excluded response → no score row at all, not a zero.
    expect(byFactor.has(ids.factor.Dk)).toBe(false);

    // Composite = mean of scored factors = (100 + 0 + 60 + 100) / 4.
    const { data: session } = await admin
      .from("participant_sessions")
      .select("composite_score")
      .eq("id", ids.session)
      .single();
    expect(Number(session!.composite_score)).toBe(65);
  });
});
