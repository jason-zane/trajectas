import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canRun, createAdminClient } from "./_helpers/rls-fixture";

/**
 * Regression guard for the /assess/join/[linkToken] branding path.
 *
 * Two bugs made the join (register) page always render in platform branding
 * while every later page was on-brand:
 *   1. The access-link lookup embedded `campaigns` twice
 *      (`campaigns(*), campaigns(client_id)`), which PostgREST rejects with
 *      42712 "table name specified more than once" — nulling the result so
 *      no campaign/client id reached brand resolution.
 *   2. The page injected only `--brand-*` tokens, not the `--runner-*` tokens
 *      that drive the re-skinned form (covered by the render, not here).
 *
 * This test pins (1): the exact embed the page uses must resolve the campaign
 * and its client_id, and the duplicated embed must fail. The brand merge
 * itself (campaign override winning over platform) is covered by the
 * brand-merge unit tests; getEffectiveBrand can't run here because
 * unstable_cache needs a Next.js incremental cache absent under vitest.
 */
const ts = Date.now();
const slug = (s: string) => `join-brand-${s}-${ts}`.toLowerCase();

describe.skipIf(!canRun)("assess join branding resolution", () => {
  const admin = createAdminClient();
  const ids = { client: "", campaign: "", link: "" };
  const linkToken = `jbt-${ts}`;

  beforeAll(async () => {
    const ins = async (
      table: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      row: Record<string, any>,
    ): Promise<string> => {
      const { data, error } = await admin.from(table).insert(row).select("id").single();
      if (error) throw new Error(`${table}: ${error.message}`);
      return data!.id as string;
    };

    ids.client = await ins("clients", { name: `Join Brand ${ts}`, slug: slug("client") });
    ids.campaign = await ins("campaigns", {
      title: `Join Brand Campaign ${ts}`,
      slug: slug("campaign"),
      client_id: ids.client,
      status: "active",
    });
    ids.link = await ins("campaign_access_links", {
      campaign_id: ids.campaign,
      token: linkToken,
      label: "branding test",
    });
    // A partial campaign-level brand override — distinct from platform.
    await admin.from("brand_configs").insert({
      owner_type: "campaign",
      owner_id: ids.campaign,
      config: { primaryColor: "#2b4c9b", accentColor: "#d9915f", name: "Meridian Group" },
      is_default: false,
    });
  });

  afterAll(async () => {
    await admin.from("brand_configs").delete().eq("owner_id", ids.campaign);
    await admin.from("campaign_access_links").delete().eq("id", ids.link);
    await admin.from("campaigns").delete().eq("id", ids.campaign);
    await admin.from("clients").delete().eq("id", ids.client);
  });

  it("resolves the campaign (and client_id) via the single-embed access-link query", async () => {
    // Exactly the select used by src/app/assess/join/[linkToken]/page.tsx.
    const { data, error } = await admin
      .from("campaign_access_links")
      .select("campaign_id, campaigns(*)")
      .eq("token", linkToken)
      .eq("is_active", true)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.campaign_id).toBe(ids.campaign);
    // The embedded campaign carries client_id — no second embed needed.
    const campaign = Array.isArray(data!.campaigns) ? data!.campaigns[0] : data!.campaigns;
    expect((campaign as Record<string, unknown>).client_id).toBe(ids.client);
  });

  it("rejects a duplicated campaigns embed (the original bug)", async () => {
    const { error } = await admin
      .from("campaign_access_links")
      .select("campaign_id, campaigns(*), campaigns(client_id)")
      .eq("token", linkToken)
      .maybeSingle();

    // PostgREST 42712 — this is what silently broke join-page branding.
    expect(error).not.toBeNull();
  });
});
