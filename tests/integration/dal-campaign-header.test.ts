import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";
import { getCampaignHeader } from "@/lib/dal/campaigns";

const ts = Date.now();
const slug = (s: string) => `dalch-${s}-${ts}`.toLowerCase();

/**
 * Validates the getCampaignHeader queries against the live local schema: the
 * campaigns → clients(name, can_customize_branding) embedded select, the
 * head-only count on campaign_assessments, and the deleted_at filter. The row →
 * DTO mapping is unit-tested in dal-campaigns-mappers.test.ts.
 */
describe.skipIf(!canRun)("dal/campaigns: getCampaignHeader", () => {
  const admin = createAdminClient();
  const ids = { client: "", campaign: "", assessment: "", link: "" };

  beforeAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ins = async (t: string, row: Record<string, any>): Promise<string> => {
      const { data, error } = await admin.from(t).insert(row).select("id").single();
      if (error) throw new Error(`${t} insert: ${error.message}`);
      return data!.id;
    };

    ids.client = await ins("clients", {
      name: `DAL CH Client ${ts}`,
      slug: slug("client"),
      can_customize_branding: true,
    });
    ids.campaign = await ins("campaigns", {
      title: `DAL CH Campaign ${ts}`,
      slug: slug("campaign"),
      client_id: ids.client,
    });
    ids.assessment = await ins("assessments", {
      title: `DAL CH Assessment ${ts}`,
      slug: slug("assessment"),
    });
    ids.link = await ins("campaign_assessments", {
      campaign_id: ids.campaign,
      assessment_id: ids.assessment,
    });
  });

  afterAll(async () => {
    await admin.from("campaign_assessments").delete().eq("id", ids.link);
    await admin.from("assessments").delete().eq("id", ids.assessment);
    await admin.from("campaigns").delete().eq("id", ids.campaign);
    await admin.from("clients").delete().eq("id", ids.client);
  });

  it("returns the campaign header with client + assessment count", async () => {
    const header = await getCampaignHeader(admin, ids.campaign);
    expect(header).not.toBeNull();
    expect(header).toMatchObject({
      id: ids.campaign,
      clientName: `DAL CH Client ${ts}`,
      clientCanCustomizeBranding: true,
      assessmentCount: 1,
    });
  });

  it("returns null for a non-existent campaign", async () => {
    const header = await getCampaignHeader(
      admin,
      "00000000-0000-0000-0000-000000000000",
    );
    expect(header).toBeNull();
  });
});
