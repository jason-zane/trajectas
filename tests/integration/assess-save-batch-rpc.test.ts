// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";

/**
 * End-to-end test of the batched save path against the live local schema:
 * POST /api/assess/save-batch → save_responses_batch_for_session RPC.
 *
 * The scenario under test is the silent-data-loss bug: a batch containing an
 * item that does NOT belong to the session's assessment. The RPC skips that
 * item (no assessment_section_items row), and the client-visible response
 * must identify exactly which items were saved — the unmatched item must not
 * be reported as saved, or the runner marks it synced in IndexedDB and the
 * participant's response is permanently lost.
 */

const admin = createAdminClient();

// Route the API handler's service-role client through the guarded fixture
// client so this test can never open a connection to a non-local database.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => admin,
}));

const { POST } = await import("@/app/api/assess/save-batch/route");

const ts = Date.now();
const slug = (s: string) => `sbr-${s}-${ts}`.toLowerCase();

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/assess/save-batch", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe.skipIf(!canRun)("assess: save-batch RPC (live schema)", () => {
  const ids = {
    client: "",
    campaign: "",
    assessment: "",
    responseFormat: "",
    section: "",
    itemInAssessment: "",
    itemOutsideAssessment: "",
    participant: "",
    session: "",
  };
  let accessToken = "";

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
      name: `SBR Client ${ts}`,
      slug: slug("client"),
    });
    ids.campaign = await ins("campaigns", {
      title: `SBR Campaign ${ts}`,
      slug: slug("campaign"),
      client_id: ids.client,
      status: "active",
    });
    ids.assessment = await ins("assessments", {
      title: `SBR Assessment ${ts}`,
      slug: slug("assessment"),
    });
    ids.responseFormat = await ins("response_formats", {
      name: `SBR Likert ${ts}`,
      type: "likert",
      config: { scale: 5 },
    });
    ids.section = await ins("assessment_sections", {
      assessment_id: ids.assessment,
      response_format_id: ids.responseFormat,
      title: "Section 1",
      display_order: 0,
    });
    ids.itemInAssessment = await ins("items", {
      response_format_id: ids.responseFormat,
      stem: `SBR in-assessment item ${ts}`,
      purpose: "impression_management",
    });
    // A real library item that is NOT wired into this assessment — the exact
    // misconfiguration the RPC used to swallow silently.
    ids.itemOutsideAssessment = await ins("items", {
      response_format_id: ids.responseFormat,
      stem: `SBR outside item ${ts}`,
      purpose: "impression_management",
    });
    await ins("assessment_section_items", {
      section_id: ids.section,
      item_id: ids.itemInAssessment,
      display_order: 0,
    });
    // The RPC's ownership predicate requires a LIVE campaign_assessments
    // attachment for campaign sessions.
    await ins("campaign_assessments", {
      campaign_id: ids.campaign,
      assessment_id: ids.assessment,
      display_order: 0,
    });

    const { data: participant, error: participantErr } = await admin
      .from("campaign_participants")
      .insert({
        campaign_id: ids.campaign,
        email: `sbr-${ts}@test.local`,
        first_name: "Sam",
      })
      .select("id, access_token")
      .single();
    if (participantErr) {
      throw new Error(`campaign_participants insert: ${participantErr.message}`);
    }
    ids.participant = participant!.id;
    accessToken = participant!.access_token;

    ids.session = await ins("participant_sessions", {
      campaign_participant_id: ids.participant,
      campaign_id: ids.campaign,
      assessment_id: ids.assessment,
      client_id: ids.client,
      status: "in_progress",
      started_at: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    if (!canRun) return;
    // FK order: session delete cascades participant_responses; assessment
    // delete cascades sections + section items.
    await admin.from("participant_sessions").delete().eq("id", ids.session);
    await admin.from("campaign_participants").delete().eq("id", ids.participant);
    await admin
      .from("campaign_assessments")
      .delete()
      .eq("campaign_id", ids.campaign);
    await admin.from("campaigns").delete().eq("id", ids.campaign);
    await admin.from("clients").delete().eq("id", ids.client);
    await admin.from("assessments").delete().eq("id", ids.assessment);
    await admin
      .from("items")
      .delete()
      .in("id", [ids.itemInAssessment, ids.itemOutsideAssessment]);
    await admin.from("response_formats").delete().eq("id", ids.responseFormat);
  });

  it("identifies saved items and does NOT report an unmatched item as saved", async () => {
    const res = await POST(
      makeRequest({
        token: accessToken,
        sessionId: ids.session,
        saves: [
          {
            itemId: ids.itemInAssessment,
            responseValue: 4,
            idempotencyKey: "sbr-in",
          },
          {
            itemId: ids.itemOutsideAssessment,
            responseValue: 2,
            idempotencyKey: "sbr-out",
          },
        ],
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();

    // The client-visible contract: exactly the matched item is confirmed.
    expect(body.success).toBe(true);
    expect(body.saved).toBe(1);
    expect(body.savedItemIds).toEqual([ids.itemInAssessment]);
    expect(body.savedItemIds).not.toContain(ids.itemOutsideAssessment);
    expect(body.idempotencyKeys).toEqual(["sbr-in"]);

    // And the database agrees: one row, for the matched item only.
    const { data: rows } = await admin
      .from("participant_responses")
      .select("item_id, response_value")
      .eq("session_id", ids.session);
    expect(rows).toHaveLength(1);
    expect(rows![0].item_id).toBe(ids.itemInAssessment);
    expect(Number(rows![0].response_value)).toBe(4);
  });

  it("returns 403 for a wrong access token without saving anything", async () => {
    const res = await POST(
      makeRequest({
        token: "not-the-real-token",
        sessionId: ids.session,
        saves: [
          {
            itemId: ids.itemInAssessment,
            responseValue: 5,
            idempotencyKey: "sbr-forbidden",
          },
        ],
      }),
    );

    expect(res.status).toBe(403);

    const { data: rows } = await admin
      .from("participant_responses")
      .select("item_id, response_value")
      .eq("session_id", ids.session)
      .eq("item_id", ids.itemInAssessment);
    // Still the value from the earlier test — the forbidden call wrote nothing.
    expect(rows).toHaveLength(1);
    expect(Number(rows![0].response_value)).toBe(4);
  });
});
