import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";
import { scoreSessionCTT } from "@/lib/scoring/ctt-session";

const ts = Date.now();
const slug = (s: string) => `cbs-${s}-${ts}`.toLowerCase();

/**
 * End-to-end regression for binary-item scoring (scoreSessionCTT).
 *
 * The seeded binary response format carries no minValue/maxValue/points in
 * its config, so the scorer used to fall back to Likert 1–5 bounds while the
 * item's options are worth 0/1 — a "No" (0) produced POMP = -25 and a "Yes"
 * (1) produced POMP = 0, silently corrupting participant_scores. The scorer
 * now derives bounds from item_options, so binary responses must persist as
 * exactly 0 and 100.
 *
 * Four factors, one binary item each:
 *   - factorNo:   forward-scored, response 0 → 0 POMP
 *   - factorYes:  forward-scored, response 1 → 100 POMP
 *   - factorRev:  reverse-scored, response 0 → 100 POMP
 *   - factorBare: forward-scored, response 1 → 100 POMP — the item has NO
 *     item_options and its format config carries no labels/trueValue (the
 *     AI-generated-item shape); bounds must come from the binary type net.
 */
describe.skipIf(!canRun)("scoring: scoreSessionCTT binary bounds", () => {
  const admin = createAdminClient();

  const ids = {
    client: "",
    campaign: "",
    assessment: "",
    participant: "",
    session: "",
    format: "",
    formatBare: "",
    factorNo: "",
    factorYes: "",
    factorRev: "",
    factorBare: "",
    constructNo: "",
    constructYes: "",
    constructRev: "",
    constructBare: "",
    itemNo: "",
    itemYes: "",
    itemRev: "",
    itemBare: "",
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
      name: `CBS Client ${ts}`,
      slug: slug("client"),
    });
    ids.campaign = await ins("campaigns", {
      title: `CBS Campaign ${ts}`,
      slug: slug("campaign"),
      client_id: ids.client,
    });
    ids.assessment = await ins("assessments", {
      title: `CBS Assessment ${ts}`,
      slug: slug("assessment"),
    });

    // Binary format mirroring the seeded config exactly: no bounds, no points.
    ids.format = await ins("response_formats", {
      name: `CBS Binary ${ts}`,
      type: "binary",
      config: { options: 2, labels: { "0": "No", "1": "Yes" } },
    });
    // Bare binary format: config carries no labels/trueValue either — bounds
    // can only come from the format type.
    ids.formatBare = await ins("response_formats", {
      name: `CBS Binary Bare ${ts}`,
      type: "binary",
      config: { options: 2 },
    });

    for (const key of ["No", "Yes", "Rev", "Bare"] as const) {
      const factorId = await ins("factors", {
        name: `CBS Factor ${key} ${ts}`,
        slug: slug(`factor-${key}`),
      });
      const constructId = await ins("constructs", {
        name: `CBS Construct ${key} ${ts}`,
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
        response_format_id: key === "Bare" ? ids.formatBare : ids.format,
        stem: `CBS binary item ${key} ${ts}`,
        construct_id: constructId,
        reverse_scored: key === "Rev",
        status: "active",
      });
      // The Bare item deliberately gets no item_options (AI-generated shape).
      if (key !== "Bare") {
        for (const [label, value] of [
          ["No", 0],
          ["Yes", 1],
        ] as const) {
          await ins("item_options", {
            item_id: itemId,
            label,
            value,
            display_order: value,
          });
        }
      }
      ids[`factor${key}`] = factorId;
      ids[`construct${key}`] = constructId;
      ids[`item${key}`] = itemId;
    }

    ids.participant = await ins("campaign_participants", {
      campaign_id: ids.campaign,
      email: `cbs-${ts}@test.local`,
      first_name: "Bin",
    });
    ids.session = await ins("participant_sessions", {
      campaign_participant_id: ids.participant,
      campaign_id: ids.campaign,
      assessment_id: ids.assessment,
      client_id: ids.client,
      status: "completed",
    });

    for (const [itemId, value] of [
      [ids.itemNo, 0],
      [ids.itemYes, 1],
      [ids.itemRev, 0],
      [ids.itemBare, 1],
    ] as const) {
      await ins("participant_responses", {
        session_id: ids.session,
        item_id: itemId,
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
      .in(
        "id",
        [ids.itemNo, ids.itemYes, ids.itemRev, ids.itemBare].filter(Boolean),
      );
    await admin
      .from("response_formats")
      .delete()
      .in("id", [ids.format, ids.formatBare].filter(Boolean));
    await admin.from("assessments").delete().eq("id", ids.assessment);
    await admin
      .from("factors")
      .delete()
      .in(
        "id",
        [ids.factorNo, ids.factorYes, ids.factorRev, ids.factorBare].filter(
          Boolean,
        ),
      );
    await admin
      .from("constructs")
      .delete()
      .in(
        "id",
        [
          ids.constructNo,
          ids.constructYes,
          ids.constructRev,
          ids.constructBare,
        ].filter(Boolean),
      );
    await admin.from("campaigns").delete().eq("id", ids.campaign);
    await admin.from("clients").delete().eq("id", ids.client);
  });

  it("persists binary responses as 0 / 100 POMP, never negative", async () => {
    const result = await scoreSessionCTT(ids.session);
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
    expect(byFactor.get(ids.factorNo)).toBe(0); // was -25 with 1–5 bounds
    expect(byFactor.get(ids.factorYes)).toBe(100); // was 0 with 1–5 bounds
    expect(byFactor.get(ids.factorRev)).toBe(100); // reverse-scored "No"
    expect(byFactor.get(ids.factorBare)).toBe(100); // no options, bare config

    for (const s of scores ?? []) {
      expect(Number(s.scaled_score)).toBeGreaterThanOrEqual(0);
      expect(Number(s.scaled_score)).toBeLessThanOrEqual(100);
      expect(Number(s.raw_score)).toBe(Number(s.scaled_score));
    }

    // Composite = mean of factor scores = (0 + 100 + 100 + 100) / 4.
    const { data: session } = await admin
      .from("participant_sessions")
      .select("composite_score, composite_method")
      .eq("id", ids.session)
      .single();
    expect(Number(session!.composite_score)).toBe(75);
    expect(session!.composite_method).toBe("mean_of_children");
  });
});
