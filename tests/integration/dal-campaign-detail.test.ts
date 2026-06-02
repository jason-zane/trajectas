import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";
import { getCampaignDetailParts } from "@/lib/dal/campaigns";
import { assembleCampaignDetail } from "@/lib/dal/campaigns-mappers";
import type { CampaignHeader } from "@/app/actions/campaigns";

const ts = Date.now();
const slug = (s: string) => `dalcd-${s}-${ts}`.toLowerCase();

/**
 * Validates the getCampaignDetailParts queries against the live local schema
 * (the campaign_assessments→assessments join, the non-rater participant filter
 * with embedded sessions, and the access-links read), then assembles the full
 * CampaignDetail to confirm the parts feed the pure assembler. The mapping
 * itself is unit-tested in dal-campaigns-mappers.test.ts.
 */
describe.skipIf(!canRun)("dal/campaigns: getCampaignDetailParts", () => {
  const admin = createAdminClient();
  const ids = {
    client: "",
    campaign: "",
    assessment: "",
    link: "",
    participant: "",
    session: "",
    accessLink: "",
  };

  beforeAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ins = async (t: string, row: Record<string, any>): Promise<string> => {
      const { data, error } = await admin.from(t).insert(row).select("id").single();
      if (error) throw new Error(`${t} insert: ${error.message}`);
      return data!.id;
    };

    ids.client = await ins("clients", { name: `DAL CD Client ${ts}`, slug: slug("client") });
    ids.campaign = await ins("campaigns", {
      title: `DAL CD Campaign ${ts}`,
      slug: slug("campaign"),
      client_id: ids.client,
    });
    ids.assessment = await ins("assessments", {
      title: `DAL CD Assessment ${ts}`,
      slug: slug("assessment"),
    });
    ids.link = await ins("campaign_assessments", {
      campaign_id: ids.campaign,
      assessment_id: ids.assessment,
    });
    ids.participant = await ins("campaign_participants", {
      campaign_id: ids.campaign,
      email: `dalcd-${ts}@test.local`,
      first_name: "Pat",
    });
    ids.session = await ins("participant_sessions", {
      campaign_participant_id: ids.participant,
      assessment_id: ids.assessment,
      status: "completed",
    });
    ids.accessLink = await ins("campaign_access_links", { campaign_id: ids.campaign });
  });

  afterAll(async () => {
    await admin.from("campaign_access_links").delete().eq("id", ids.accessLink);
    await admin.from("participant_sessions").delete().eq("id", ids.session);
    await admin.from("campaign_participants").delete().eq("id", ids.participant);
    await admin.from("campaign_assessments").delete().eq("id", ids.link);
    await admin.from("assessments").delete().eq("id", ids.assessment);
    await admin.from("campaigns").delete().eq("id", ids.campaign);
    await admin.from("clients").delete().eq("id", ids.client);
  });

  it("fetches the assessment / participant / link row sets", async () => {
    const parts = await getCampaignDetailParts(admin, ids.campaign);
    expect(parts).not.toBeNull();
    expect(parts!.assessmentRows).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((parts!.assessmentRows![0] as any).assessments?.title).toBe(
      `DAL CD Assessment ${ts}`,
    );
    expect(parts!.participantRows).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((parts!.participantRows![0] as any).participant_sessions).toHaveLength(1);
    expect(parts!.linkRows).toHaveLength(1);
  });

  it("feeds the assembler to produce a full CampaignDetail", async () => {
    const parts = await getCampaignDetailParts(admin, ids.campaign);
    const header = {
      id: ids.campaign,
      title: `DAL CD Campaign ${ts}`,
      slug: slug("campaign"),
      status: "draft",
      branding: {},
      created_at: "2026-01-01T00:00:00Z",
      clientName: `DAL CD Client ${ts}`,
      clientCanCustomizeBranding: null,
      assessmentCount: 1,
    } as unknown as CampaignHeader;

    const detail = assembleCampaignDetail(header, parts!);
    expect(detail.id).toBe(ids.campaign);
    expect(detail.assessments[0].assessmentTitle).toBe(`DAL CD Assessment ${ts}`);
    expect(detail.participants[0].id).toBe(ids.participant);
    expect(detail.accessLinks).toHaveLength(1);
  });
});
