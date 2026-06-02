import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";
import { listCampaigns } from "@/lib/dal/campaigns";

const ts = Date.now();
const slug = (s: string) => `dalcl-${s}-${ts}`.toLowerCase();

/**
 * Validates the listCampaigns query against the live local schema: the
 * campaigns_with_counts view shape (inlined counts + embedded clients(name)),
 * the deleted_at filter, and the client-id / campaign-id scope branches. The
 * row → DTO mapping is unit-tested in tests/unit/dal-campaigns-mappers.test.ts.
 */
describe.skipIf(!canRun)("dal/campaigns: listCampaigns", () => {
  const admin = createAdminClient();
  const ids = { client: "", campaign: "", deletedCampaign: "" };

  beforeAll(async () => {
    const { data: c, error: cErr } = await admin
      .from("clients")
      .insert({ name: `DAL Camp Client ${ts}`, slug: slug("client") })
      .select("id")
      .single();
    if (cErr) throw new Error(`client insert: ${cErr.message}`);
    ids.client = c!.id;

    const { data: cam, error: camErr } = await admin
      .from("campaigns")
      .insert({ title: `DAL Camp ${ts}`, slug: slug("campaign"), client_id: ids.client })
      .select("id")
      .single();
    if (camErr) throw new Error(`campaign insert: ${camErr.message}`);
    ids.campaign = cam!.id;

    const { data: del, error: delErr } = await admin
      .from("campaigns")
      .insert({
        title: `DAL Camp Deleted ${ts}`,
        slug: slug("campaign-del"),
        client_id: ids.client,
        deleted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (delErr) throw new Error(`deleted campaign insert: ${delErr.message}`);
    ids.deletedCampaign = del!.id;
  });

  afterAll(async () => {
    await admin
      .from("campaigns")
      .delete()
      .in("id", [ids.campaign, ids.deletedCampaign].filter(Boolean));
    await admin.from("clients").delete().eq("id", ids.client);
  });

  it("returns a client's non-deleted campaigns with counts + client name", async () => {
    const rows = await listCampaigns(admin, {
      effectiveClientId: ids.client,
      scopedCampaignIds: null,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: ids.campaign,
      clientName: `DAL Camp Client ${ts}`,
      assessmentCount: 0,
      participantCount: 0,
      completedCount: 0,
    });
  });

  it("scopes by campaign id when there is no client filter", async () => {
    const rows = await listCampaigns(admin, {
      effectiveClientId: null,
      scopedCampaignIds: [ids.campaign],
    });
    expect(rows.map((r) => r.id)).toEqual([ids.campaign]);
  });

  it("fails closed on an empty campaign scope", async () => {
    const rows = await listCampaigns(admin, {
      effectiveClientId: null,
      scopedCampaignIds: [],
    });
    expect(rows).toEqual([]);
  });
});
