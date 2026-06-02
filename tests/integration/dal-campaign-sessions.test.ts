import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";
import { getCampaignSessions } from "@/lib/dal/campaigns";

const ts = Date.now();
const slug = (s: string) => `dalcs-${s}-${ts}`.toLowerCase();

/**
 * Validates the getCampaignSessions query against the live local schema: the
 * participant_sessions → assessments + campaign_participants!inner join and the
 * campaign_participants.campaign_id filter. Attempt-numbering/sort is unit-tested
 * in tests/unit/dal-campaigns-mappers.test.ts.
 */
describe.skipIf(!canRun)("dal/campaigns: getCampaignSessions", () => {
  const admin = createAdminClient();
  const ids = {
    client: "",
    campaign: "",
    assessment: "",
    assessment2: "",
    participant: "",
    s1: "",
    s2: "",
  };

  beforeAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ins = async (t: string, row: Record<string, any>): Promise<string> => {
      const { data, error } = await admin.from(t).insert(row).select("id").single();
      if (error) throw new Error(`${t} insert: ${error.message}`);
      return data!.id;
    };

    ids.client = await ins("clients", {
      name: `DAL CS Client ${ts}`,
      slug: slug("client"),
    });
    ids.campaign = await ins("campaigns", {
      title: `DAL CS Campaign ${ts}`,
      slug: slug("campaign"),
      client_id: ids.client,
    });
    ids.assessment = await ins("assessments", {
      title: `DAL CS Assessment ${ts}`,
      slug: slug("assessment"),
    });
    ids.assessment2 = await ins("assessments", {
      title: `DAL CS Assessment 2 ${ts}`,
      slug: slug("assessment2"),
    });
    ids.participant = await ins("campaign_participants", {
      campaign_id: ids.campaign,
      email: `dalcs-${ts}@test.local`,
      first_name: "Cara",
      last_name: "Lee",
    });
    // Two sessions on different assessments — a unique partial index forbids two
    // active sessions for the same (participant, assessment). Attempt-numbering
    // across same-pair retakes is covered by the unit test.
    ids.s1 = await ins("participant_sessions", {
      campaign_participant_id: ids.participant,
      assessment_id: ids.assessment,
      status: "completed",
      started_at: "2026-01-01T00:00:00Z",
      completed_at: "2026-01-01T01:00:00Z",
    });
    ids.s2 = await ins("participant_sessions", {
      campaign_participant_id: ids.participant,
      assessment_id: ids.assessment2,
      status: "in_progress",
      started_at: "2026-01-02T00:00:00Z",
    });
  });

  afterAll(async () => {
    await admin
      .from("participant_sessions")
      .delete()
      .in("id", [ids.s1, ids.s2].filter(Boolean));
    await admin.from("campaign_participants").delete().eq("id", ids.participant);
    await admin
      .from("assessments")
      .delete()
      .in("id", [ids.assessment, ids.assessment2].filter(Boolean));
    await admin.from("campaigns").delete().eq("id", ids.campaign);
    await admin.from("clients").delete().eq("id", ids.client);
  });

  it("returns the campaign's sessions joined to participant + assessment", async () => {
    const sessions = await getCampaignSessions(admin, ids.campaign);
    expect(sessions).toHaveLength(2);
    // newest first (s2 started 2026-01-02 > s1 completed 2026-01-01)
    expect(sessions[0].id).toBe(ids.s2);
    expect(sessions[0]).toMatchObject({
      participantName: "Cara Lee",
      participantEmail: `dalcs-${ts}@test.local`,
      assessmentTitle: `DAL CS Assessment 2 ${ts}`,
      attemptNumber: 1,
    });
  });

  it("returns [] for a campaign with no sessions", async () => {
    const sessions = await getCampaignSessions(
      admin,
      "00000000-0000-0000-0000-000000000000",
    );
    expect(sessions).toEqual([]);
  });
});
