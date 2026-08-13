/**
 * sweepAssessmentTiming (LR-2 / #332) — the durable backstop for section
 * finalisation when the participant's client-side timer never got to fire
 * (closed tab, crash, offline right at the deadline).
 *
 * Requires a running local Supabase instance. Run with
 * `npm run test:integration:local`.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sweepAssessmentTiming, SECTION_TIMING_SWEEP_STALE_MS } from "@/lib/assess/timing-sweep";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";

const ts = Date.now();
const testSlug = (label: string) => `sweep-${label}-${ts}`;

describe.skipIf(!canRun)("sweepAssessmentTiming", () => {
  const adminDb = createAdminClient();

  const ids = {
    partner: "",
    client: "",
    responseFormat: "",
    assessment: "",
    sectionA: "",
    sectionB: "",
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

    ids.partner = await insertRow("partners", { name: `Sweep Partner ${ts}`, slug: testSlug("partner") });
    ids.client = await insertRow("clients", {
      name: `Sweep Client ${ts}`,
      slug: testSlug("client"),
      partner_id: ids.partner,
    });
    ids.responseFormat = await insertRow("response_formats", {
      name: `Likert ${ts}`,
      type: "likert",
      config: { points: 5 },
    });
    ids.assessment = await insertRow("assessments", {
      title: `Sweep Assessment ${ts}`,
      slug: testSlug("assessment"),
      client_id: ids.client,
      partner_id: ids.partner,
      status: "active",
    });
    ids.sectionA = await insertRow("assessment_sections", {
      assessment_id: ids.assessment,
      response_format_id: ids.responseFormat,
      title: "Abandoned Section",
      time_limit_seconds: 60,
    });
    ids.sectionB = await insertRow("assessment_sections", {
      assessment_id: ids.assessment,
      response_format_id: ids.responseFormat,
      title: "Recently Expired (not yet stale) Section",
      time_limit_seconds: 60,
    });
    ids.campaign = await insertRow("campaigns", {
      title: `Sweep Campaign ${ts}`,
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
      email: `sweep-${ts}@test.local`,
      first_name: "Abandoned",
      last_name: "Session",
      status: "in_progress",
      access_token: `sweep-token-${ts}`,
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
    await adminDb.from("participant_section_states").delete().eq("session_id", ids.session);
    await adminDb.from("participant_sessions").delete().eq("id", ids.session);
    await adminDb.from("campaign_participants").delete().eq("id", ids.participant);
    await adminDb.from("campaign_assessments").delete().eq("campaign_id", ids.campaign);
    await adminDb.from("campaigns").delete().eq("id", ids.campaign);
    await adminDb.from("assessment_sections").delete().in("id", [ids.sectionA, ids.sectionB]);
    await adminDb.from("assessments").delete().eq("id", ids.assessment);
    await adminDb.from("response_formats").delete().eq("id", ids.responseFormat);
    await adminDb.from("clients").delete().eq("id", ids.client);
    await adminDb.from("partners").delete().eq("id", ids.partner);
  }, 60_000);

  it("finalises a section whose deadline passed well beyond the stale threshold, leaves a recently-expired one alone, and is idempotent", async () => {
    const now = new Date();
    const longAbandoned = new Date(now.getTime() - SECTION_TIMING_SWEEP_STALE_MS - 5 * 60_000);
    const recentlyExpired = new Date(now.getTime() - 60_000); // 1 min ago — well inside the stale window

    await adminDb.from("participant_section_states").insert([
      {
        session_id: ids.session,
        section_id: ids.sectionA,
        started_at: new Date(longAbandoned.getTime() - 60_000).toISOString(),
        base_limit_seconds: 60,
        deadline_at: longAbandoned.toISOString(),
      },
      {
        session_id: ids.session,
        section_id: ids.sectionB,
        started_at: new Date(recentlyExpired.getTime() - 60_000).toISOString(),
        base_limit_seconds: 60,
        deadline_at: recentlyExpired.toISOString(),
      },
    ]);

    const result = await sweepAssessmentTiming({ client: adminDb, now });
    expect(result.finalised).toBe(1);

    const { data: rows } = await adminDb
      .from("participant_section_states")
      .select("section_id, finalised_at, finalised_by, expired_at")
      .eq("session_id", ids.session)
      .order("section_id");

    const byId = new Map((rows ?? []).map((r) => [r.section_id, r]));
    const rowA = byId.get(ids.sectionA)!;
    const rowB = byId.get(ids.sectionB)!;

    expect(rowA.finalised_at).toBeTruthy();
    expect(rowA.finalised_by).toBe("sweep");
    expect(rowA.expired_at).toBeTruthy();

    // Not yet stale enough — the client-timer path (or a later sweep run)
    // still gets first refusal.
    expect(rowB.finalised_at).toBeNull();

    // A second run must not error or double-finalise / overwrite finalised_by.
    const second = await sweepAssessmentTiming({ client: adminDb, now: new Date(now.getTime() + 1000) });
    expect(second.finalised).toBe(0);
  });
});
