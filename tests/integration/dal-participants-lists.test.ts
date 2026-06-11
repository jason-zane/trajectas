import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";
import {
  listParticipants,
  listUniqueParticipants,
  listUniqueParticipantsForClient,
} from "@/lib/dal/participants";

const ts = Date.now();
const slug = (s: string) => `dalpl-${s}-${ts}`.toLowerCase();

/**
 * Validates the participant list queries (campaigns!inner join, deleted_at
 * filters, campaign-scope + search filters, session-count enrichment) against
 * the live local schema. The dedup/pagination/meta logic is unit-tested in
 * tests/unit/dal-participants-mappers.test.ts.
 */
describe.skipIf(!canRun)("dal/participants: list queries", () => {
  const admin = createAdminClient();
  const ids = {
    client: "",
    campaign: "",
    assessment: "",
    assessment2: "",
    pA: "",
    pB: "",
    sA1: "",
    sA2: "",
  };
  const emailA = `dalpl-alice-${ts}@test.local`;
  const emailB = `dalpl-bob-${ts}@test.local`;

  beforeAll(async () => {
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
      return data!.id;
    };

    ids.client = await ins("clients", {
      name: `DAL Lists Client ${ts}`,
      slug: slug("client"),
    });
    ids.campaign = await ins("campaigns", {
      title: `DAL Lists Campaign ${ts}`,
      slug: slug("campaign"),
      client_id: ids.client,
    });
    ids.assessment = await ins("assessments", {
      title: `DAL Lists Assessment ${ts}`,
      slug: slug("assessment"),
    });
    ids.assessment2 = await ins("assessments", {
      title: `DAL Lists Assessment 2 ${ts}`,
      slug: slug("assessment2"),
    });
    ids.pA = await ins("campaign_participants", {
      campaign_id: ids.campaign,
      email: emailA,
      first_name: "Alice",
    });
    ids.pB = await ins("campaign_participants", {
      campaign_id: ids.campaign,
      email: emailB,
      first_name: "Bob",
    });
    ids.sA1 = await ins("participant_sessions", {
      campaign_participant_id: ids.pA,
      assessment_id: ids.assessment,
      status: "completed",
    });
    ids.sA2 = await ins("participant_sessions", {
      campaign_participant_id: ids.pA,
      assessment_id: ids.assessment2,
      status: "in_progress",
    });
  });

  afterAll(async () => {
    await admin
      .from("participant_sessions")
      .delete()
      .in("id", [ids.sA1, ids.sA2].filter(Boolean));
    await admin
      .from("campaign_participants")
      .delete()
      .in("id", [ids.pA, ids.pB].filter(Boolean));
    await admin
      .from("assessments")
      .delete()
      .in("id", [ids.assessment, ids.assessment2].filter(Boolean));
    await admin.from("campaigns").delete().eq("id", ids.campaign);
    await admin.from("clients").delete().eq("id", ids.client);
  });

  it("lists scoped participants with session counts", async () => {
    const { data, total } = await listParticipants(admin, {
      scopedCampaignIds: [ids.campaign],
      offset: 0,
      perPage: 50,
    });
    expect(total).toBe(2);

    const alice = data.find((d) => d.id === ids.pA);
    expect(alice).toMatchObject({
      campaignTitle: `DAL Lists Campaign ${ts}`,
      sessionCount: 2,
      completedSessionCount: 1,
    });
    const bob = data.find((d) => d.id === ids.pB);
    expect(bob).toMatchObject({ sessionCount: 0, completedSessionCount: 0 });
  });

  it("applies the search filter", async () => {
    const { data, total } = await listParticipants(admin, {
      scopedCampaignIds: [ids.campaign],
      search: "alice",
      offset: 0,
      perPage: 50,
    });
    expect(total).toBe(1);
    expect(data[0].id).toBe(ids.pA);
  });

  it("fails closed on an empty scope", async () => {
    const { data, total } = await listParticipants(admin, {
      scopedCampaignIds: [],
      offset: 0,
      perPage: 50,
    });
    expect(total).toBe(0);
    expect(data).toEqual([]);
  });

  it("dedupes unique participants by email within scope", async () => {
    const { data, total } = await listUniqueParticipants(admin, {
      scopedCampaignIds: [ids.campaign],
      offset: 0,
      perPage: 50,
    });
    expect(total).toBe(2);
    const emails = data.map((d) => d.email).sort();
    expect(emails).toEqual([emailA, emailB].sort());
  });

  it("client portal: lists unique participants paginated", async () => {
    const { rows, totalCount, page, pageSize } =
      await listUniqueParticipantsForClient(admin, {
        clientId: ids.client,
        page: 0,
        pageSize: 50,
      });
    expect(totalCount).toBe(2);
    expect(rows.length).toBe(2);
    expect(page).toBe(0);
    expect(pageSize).toBe(50);

    const emails = rows.map((r) => r.email).sort();
    expect(emails).toEqual([emailA, emailB].sort());
  });

  it("client portal: applies search filter", async () => {
    const { rows, totalCount } = await listUniqueParticipantsForClient(admin, {
      clientId: ids.client,
      page: 0,
      pageSize: 50,
      search: "alice",
    });
    expect(totalCount).toBe(1);
    expect(rows.length).toBe(1);
    expect(rows[0].email).toBe(emailA);
  });

  it("client portal: paginates correctly", async () => {
    const { rows: page0, totalCount } =
      await listUniqueParticipantsForClient(admin, {
        clientId: ids.client,
        page: 0,
        pageSize: 1,
      });
    expect(totalCount).toBe(2);
    expect(page0.length).toBe(1);

    const { rows: page1 } = await listUniqueParticipantsForClient(admin, {
      clientId: ids.client,
      page: 1,
      pageSize: 1,
    });
    expect(page1.length).toBe(1);

    // Pages should contain different participants
    expect(page0[0].email).not.toBe(page1[0].email);
  });

  it("client portal: respects session count and campaign context", async () => {
    const { rows } = await listUniqueParticipantsForClient(admin, {
      clientId: ids.client,
      page: 0,
      pageSize: 50,
    });

    const alice = rows.find((r) => r.email === emailA);
    expect(alice).toBeDefined();
    expect(alice!.sessionCount).toBe(2);
  });
});
