import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";
import { sweepResumeReminders, TIER2_DELAY_MS } from "@/lib/assess/resume-reminders";
import type { sendEmail } from "@/lib/email/send";

const ts = Date.now();
const slug = (s: string) => `arr-${s}-${ts}`.toLowerCase();

/**
 * Exercises the two-tier resume-reminder sweep against the live local schema:
 * the last_activity_at / resume_reminder_count selection and the per-session
 * counter advance. Email delivery is stubbed so nothing is actually sent.
 */
describe.skipIf(!canRun)("assess: sweepResumeReminders", () => {
  const admin = createAdminClient();

  // Captured email sends from the injected stub.
  type SendArgs = Parameters<typeof sendEmail>[0];
  let sent: SendArgs[] = [];
  const sendFn = (async (args: SendArgs) => {
    sent.push(args);
  }) as typeof sendEmail;

  const ids = {
    client: "",
    campaign: "",
    assessment: "",
    activeParticipant: "",
    doneParticipant: "",
    sessionActive: "", // in_progress, idle → should be reminded
    sessionDone: "", // completed → must never be reminded
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

  // A fixed "now" so the cutoff arithmetic is deterministic.
  const now = new Date("2026-06-05T12:00:00.000Z");
  const minutesAgo = (m: number) =>
    new Date(now.getTime() - m * 60_000).toISOString();

  const activeEmail = `arr-active-${ts}@test.local`;
  const doneEmail = `arr-done-${ts}@test.local`;
  // The sweep operates over the whole DB, so other (seed/leftover) in-progress
  // sessions may also be nudged. Scope every assertion to our own fixtures.
  const myEmails = () => sent.filter((s) => s.to === activeEmail);

  const sessionCount = async () => {
    const { data } = await admin
      .from("participant_sessions")
      .select("resume_reminder_count, resume_reminder_last_sent_at")
      .eq("id", ids.sessionActive)
      .single();
    return data!;
  };

  beforeAll(async () => {
    ids.client = await ins("clients", {
      name: `ARR Client ${ts}`,
      slug: slug("client"),
    });
    ids.campaign = await ins("campaigns", {
      title: `ARR Campaign ${ts}`,
      slug: slug("campaign"),
      client_id: ids.client,
    });
    ids.assessment = await ins("assessments", {
      title: `ARR Assessment ${ts}`,
      slug: slug("assessment"),
    });
    ids.activeParticipant = await ins("campaign_participants", {
      campaign_id: ids.campaign,
      email: `arr-active-${ts}@test.local`,
      first_name: "Avery",
    });
    ids.doneParticipant = await ins("campaign_participants", {
      campaign_id: ids.campaign,
      email: `arr-done-${ts}@test.local`,
      first_name: "Dana",
    });

    // In-progress session, quiet for 6 minutes (past the 5-min tier-1 cutoff).
    ids.sessionActive = await ins("participant_sessions", {
      campaign_participant_id: ids.activeParticipant,
      campaign_id: ids.campaign,
      assessment_id: ids.assessment,
      client_id: ids.client,
      status: "in_progress",
      started_at: minutesAgo(30),
      last_activity_at: minutesAgo(6),
    });

    // Completed session — never a reminder candidate.
    ids.sessionDone = await ins("participant_sessions", {
      campaign_participant_id: ids.doneParticipant,
      campaign_id: ids.campaign,
      assessment_id: ids.assessment,
      client_id: ids.client,
      status: "completed",
      started_at: minutesAgo(60),
      completed_at: minutesAgo(40),
      last_activity_at: minutesAgo(40),
    });
  });

  afterAll(async () => {
    await admin
      .from("participant_sessions")
      .delete()
      .in("id", [ids.sessionActive, ids.sessionDone].filter(Boolean));
    await admin
      .from("campaign_participants")
      .delete()
      .in("id", [ids.activeParticipant, ids.doneParticipant].filter(Boolean));
    await admin.from("assessments").delete().eq("id", ids.assessment);
    await admin.from("campaigns").delete().eq("id", ids.campaign);
    await admin.from("clients").delete().eq("id", ids.client);
  });

  it("sends a tier-1 nudge to the idle session and advances its counter", async () => {
    sent = [];
    const result = await sweepResumeReminders({ now, client: admin, sendFn });

    expect(result.tier1Sent).toBeGreaterThanOrEqual(1);
    expect(result.errors).toBe(0);

    // Exactly one email to our idle participant; none to the completed one.
    expect(myEmails()).toHaveLength(1);
    expect(sent.map((s) => s.to)).not.toContain(doneEmail);

    const email = myEmails()[0];
    expect(email.type).toBe("assessment_reminder");
    expect(email.variables.participantFirstName).toBe("Avery");
    expect(email.variables.assessmentUrl).toContain("/assess/");

    const session = await sessionCount();
    expect(session.resume_reminder_count).toBe(1);
    expect(session.resume_reminder_last_sent_at).not.toBeNull();
  });

  it("does not re-send tier 1 before the 24h tier-2 delay", async () => {
    sent = [];
    await sweepResumeReminders({ now, client: admin, sendFn });
    expect(myEmails()).toHaveLength(0);
    expect((await sessionCount()).resume_reminder_count).toBe(1);
  });

  it("sends the final tier-2 nudge once 24h have elapsed", async () => {
    // Pretend tier 1 went out just over 24h before "now".
    await admin
      .from("participant_sessions")
      .update({
        resume_reminder_last_sent_at: new Date(
          now.getTime() - TIER2_DELAY_MS - 60_000,
        ).toISOString(),
      })
      .eq("id", ids.sessionActive);

    sent = [];
    const result = await sweepResumeReminders({ now, client: admin, sendFn });
    expect(result.tier2Sent).toBeGreaterThanOrEqual(1);
    expect(myEmails()).toHaveLength(1);
    expect((await sessionCount()).resume_reminder_count).toBe(2);
  });

  it("stops after two reminders", async () => {
    sent = [];
    await sweepResumeReminders({ now, client: admin, sendFn });
    expect(myEmails()).toHaveLength(0);
    expect((await sessionCount()).resume_reminder_count).toBe(2);
  });
});
