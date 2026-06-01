import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";
import { getParticipantSessions } from "@/lib/dal/participants";

const ts = Date.now();
const slug = (s: string) => `dalpr-${s}-${ts}`.toLowerCase();

/**
 * Validates the getParticipantSessions query (participant_sessions → assessments
 * join, campaign_participant_id filter, created_at ordering) against the live
 * local schema. The row → DTO mapping itself is unit-tested in
 * tests/unit/dal-participants-mappers.test.ts; here we only assert the query
 * resolves and threads the assessment title through.
 */
describe.skipIf(!canRun)("dal/participants: getParticipantSessions", () => {
  const admin = createAdminClient();
  const ids = {
    client: "",
    campaign: "",
    participant: "",
    assessment: "",
    session: "",
  };

  beforeAll(async () => {
    const { data: c, error: cErr } = await admin
      .from("clients")
      .insert({ name: `DAL Reads Client ${ts}`, slug: slug("client") })
      .select("id")
      .single();
    if (cErr) throw new Error(`client insert: ${cErr.message}`);
    ids.client = c!.id;

    const { data: cam, error: camErr } = await admin
      .from("campaigns")
      .insert({ title: `DAL Reads Campaign ${ts}`, slug: slug("campaign"), client_id: ids.client })
      .select("id")
      .single();
    if (camErr) throw new Error(`campaign insert: ${camErr.message}`);
    ids.campaign = cam!.id;

    const { data: p, error: pErr } = await admin
      .from("campaign_participants")
      .insert({ campaign_id: ids.campaign, email: `dalpr-${ts}@test.local` })
      .select("id")
      .single();
    if (pErr) throw new Error(`participant insert: ${pErr.message}`);
    ids.participant = p!.id;

    const { data: a, error: aErr } = await admin
      .from("assessments")
      .insert({ title: `DAL Reads Assessment ${ts}`, slug: slug("assessment") })
      .select("id")
      .single();
    if (aErr) throw new Error(`assessment insert: ${aErr.message}`);
    ids.assessment = a!.id;

    const { data: sess, error: sErr } = await admin
      .from("participant_sessions")
      .insert({ campaign_participant_id: ids.participant, assessment_id: ids.assessment })
      .select("id")
      .single();
    if (sErr) throw new Error(`session insert: ${sErr.message}`);
    ids.session = sess!.id;
  });

  afterAll(async () => {
    await admin.from("participant_sessions").delete().eq("id", ids.session);
    await admin.from("campaign_participants").delete().eq("id", ids.participant);
    await admin.from("assessments").delete().eq("id", ids.assessment);
    await admin.from("campaigns").delete().eq("id", ids.campaign);
    await admin.from("clients").delete().eq("id", ids.client);
  });

  it("returns the participant's sessions with the assessment title joined", async () => {
    const sessions = await getParticipantSessions(admin, ids.participant);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      id: ids.session,
      assessmentId: ids.assessment,
      assessmentTitle: `DAL Reads Assessment ${ts}`,
    });
    expect(sessions[0].scores).toEqual([]);
  });

  it("returns [] for a participant with no sessions", async () => {
    const sessions = await getParticipantSessions(
      admin,
      "00000000-0000-0000-0000-000000000000",
    );
    expect(sessions).toEqual([]);
  });
});
