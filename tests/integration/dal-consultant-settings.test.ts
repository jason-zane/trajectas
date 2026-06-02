import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";
import { getCampaignConsultantSettings } from "@/lib/dal/campaigns";

const ts = Date.now();
const slug = (s: string) => `dalcons-${s}-${ts}`.toLowerCase();

/**
 * Validates the getCampaignConsultantSettings query/column names against the
 * live local schema. The row → DTO coercion is unit-tested in
 * dal-campaigns-mappers.test.ts.
 */
describe.skipIf(!canRun)("dal/campaigns: getCampaignConsultantSettings", () => {
  const admin = createAdminClient();
  const ids = { client: "", campaign: "" };

  beforeAll(async () => {
    const { data: c, error: cErr } = await admin
      .from("clients")
      .insert({ name: `DAL Cons Client ${ts}`, slug: slug("client") })
      .select("id")
      .single();
    if (cErr) throw new Error(`client insert: ${cErr.message}`);
    ids.client = c!.id;

    const { data: cam, error: camErr } = await admin
      .from("campaigns")
      .insert({
        title: `DAL Cons Campaign ${ts}`,
        slug: slug("campaign"),
        client_id: ids.client,
        consultant_emails: ["consultant@example.com"],
        consultant_notification_enabled: true,
        consultant_notification_include_summary: false,
        consultant_notification_attach_pdf: true,
      })
      .select("id")
      .single();
    if (camErr) throw new Error(`campaign insert: ${camErr.message}`);
    ids.campaign = cam!.id;
  });

  afterAll(async () => {
    await admin.from("campaigns").delete().eq("id", ids.campaign);
    await admin.from("clients").delete().eq("id", ids.client);
  });

  it("returns the campaign's consultant settings", async () => {
    const settings = await getCampaignConsultantSettings(admin, ids.campaign);
    expect(settings).toEqual({
      emails: ["consultant@example.com"],
      enabled: true,
      includeSummary: false,
      attachPdf: true,
    });
  });

  it("returns null for a non-existent campaign", async () => {
    const settings = await getCampaignConsultantSettings(
      admin,
      "00000000-0000-0000-0000-000000000000",
    );
    expect(settings).toBeNull();
  });
});
