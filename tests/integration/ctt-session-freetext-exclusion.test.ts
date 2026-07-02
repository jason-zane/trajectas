import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";
import { scoreSessionCTT } from "@/lib/scoring/ctt-session";

const ts = Date.now();
const slug = (s: string) => `cfe-${s}-${ts}`.toLowerCase();

/**
 * Free-text responses must not enter quantitative aggregates.
 *
 * The runner stores a free-text answer as response_value 0/1 (presence flag)
 * with the text in response_data. Scoring that flag as a scale value dragged
 * construct means toward 0. scoreSessionCTT now skips free_text items, so a
 * construct holding a likert item scored 100 plus an answered free-text item
 * must score exactly 100 — not the 50 a scored presence flag would produce.
 */
describe.skipIf(!canRun)("scoring: free_text excluded from aggregates", () => {
  const admin = createAdminClient();

  const ids = {
    client: "",
    campaign: "",
    assessment: "",
    participant: "",
    session: "",
    likertFormat: "",
    freeTextFormat: "",
    factor: "",
    construct: "",
    likertItem: "",
    freeTextItem: "",
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
      name: `CFE Client ${ts}`,
      slug: slug("client"),
    });
    ids.campaign = await ins("campaigns", {
      title: `CFE Campaign ${ts}`,
      slug: slug("campaign"),
      client_id: ids.client,
    });
    ids.assessment = await ins("assessments", {
      title: `CFE Assessment ${ts}`,
      slug: slug("assessment"),
    });
    ids.likertFormat = await ins("response_formats", {
      name: `CFE Likert ${ts}`,
      type: "likert",
      config: { points: 5, anchors: { "1": "Low", "5": "High" } },
    });
    ids.freeTextFormat = await ins("response_formats", {
      name: `CFE Free Text ${ts}`,
      type: "free_text",
      config: { maxLength: 500 },
    });

    ids.factor = await ins("factors", {
      name: `CFE Factor ${ts}`,
      slug: slug("factor"),
    });
    ids.construct = await ins("constructs", {
      name: `CFE Construct ${ts}`,
      slug: slug("construct"),
    });
    await ins("factor_constructs", {
      factor_id: ids.factor,
      construct_id: ids.construct,
      weight: 1.0,
    });
    await ins("assessment_factors", {
      assessment_id: ids.assessment,
      factor_id: ids.factor,
    });

    ids.likertItem = await ins("items", {
      response_format_id: ids.likertFormat,
      stem: `CFE likert item ${ts}`,
      construct_id: ids.construct,
      status: "active",
    });
    ids.freeTextItem = await ins("items", {
      response_format_id: ids.freeTextFormat,
      stem: `CFE free text item ${ts}`,
      construct_id: ids.construct,
      status: "active",
    });

    ids.participant = await ins("campaign_participants", {
      campaign_id: ids.campaign,
      email: `cfe-${ts}@test.local`,
      first_name: "Free",
    });
    ids.session = await ins("participant_sessions", {
      campaign_participant_id: ids.participant,
      campaign_id: ids.campaign,
      assessment_id: ids.assessment,
      client_id: ids.client,
      status: "completed",
    });

    await ins("participant_responses", {
      session_id: ids.session,
      item_id: ids.likertItem,
      response_value: 5,
    });
    await ins("participant_responses", {
      session_id: ids.session,
      item_id: ids.freeTextItem,
      response_value: 1,
      response_data: { text: "Qualitative colour that must not be scored." },
    });
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
      .in("id", [ids.likertItem, ids.freeTextItem].filter(Boolean));
    await admin
      .from("response_formats")
      .delete()
      .in("id", [ids.likertFormat, ids.freeTextFormat].filter(Boolean));
    await admin.from("assessments").delete().eq("id", ids.assessment);
    await admin.from("factors").delete().eq("id", ids.factor);
    await admin.from("constructs").delete().eq("id", ids.construct);
    await admin.from("campaigns").delete().eq("id", ids.campaign);
    await admin.from("clients").delete().eq("id", ids.client);
  });

  it("scores the construct from the likert item alone", async () => {
    const result = await scoreSessionCTT(ids.session);
    expect(result).toEqual({ success: true, scoreCount: 1 });

    const { data: scores } = await admin
      .from("participant_scores")
      .select("factor_id, scaled_score")
      .eq("session_id", ids.session);
    expect(scores).toHaveLength(1);
    // A scored presence flag would have dragged this to (100 + 0) / 2 = 50.
    expect(Number(scores![0].scaled_score)).toBe(100);
  });
});
