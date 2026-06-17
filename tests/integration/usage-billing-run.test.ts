import { afterAll, describe, expect, it } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";
import { previousMonthPeriod } from "@/lib/billing/usage-period";
import { runUsageBilling } from "@/lib/billing/usage-run";

/**
 * Verifies the monthly usage run freezes a per-period snapshot and is
 * idempotent. Uses a throwaway client with no campaigns (quantity = 0), so no
 * Stripe call is made here — the invoice issuance path is covered by
 * stripe-invoice-flow.test.ts. Local-host gated so it can never touch prod.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const isLocalSupabase =
  !!SUPABASE_URL &&
  /^(https?:\/\/)?(127\.0\.0\.1|localhost|host\.docker\.internal|kong)(:\d+)?(\/|$)/.test(
    SUPABASE_URL,
  );
const canRun = isLocalSupabase;

describe.skipIf(!canRun)("usage billing run (integration)", () => {
  const created: { clientId?: string; accountId?: string } = {};

  afterAll(async () => {
    const db = createAdminClient();
    if (created.accountId) {
      await db.from("billing_usage_snapshots").delete().eq("billing_account_id", created.accountId);
      await db.from("invoices").delete().eq("billing_account_id", created.accountId);
      await db.from("billing_accounts").delete().eq("id", created.accountId);
    }
    if (created.clientId) {
      await db.from("clients").delete().eq("id", created.clientId);
    }
  });

  it("freezes a snapshot for the period and does not double-bill on re-run", async () => {
    const db = createAdminClient();
    const now = new Date();
    const slug = `zz-usage-test-${now.getTime()}`;

    const { data: client, error: clientErr } = await db
      .from("clients")
      .insert({ name: "Usage Test Co", slug, is_active: true })
      .select("id")
      .single();
    expect(clientErr).toBeNull();
    created.clientId = client!.id as string;

    const { data: account } = await db
      .from("billing_accounts")
      .insert({
        client_id: created.clientId,
        billing_email: "billing+usage@trajectas.com",
        usage_billing_enabled: true,
        usage_unit_price_cents: 2500,
      })
      .select("id")
      .single();
    created.accountId = account!.id as string;

    const period = previousMonthPeriod(now);

    const first = await runUsageBilling(now);
    expect(first.accounts).toBeGreaterThan(0);

    const { data: snap } = await db
      .from("billing_usage_snapshots")
      .select("*")
      .eq("billing_account_id", created.accountId)
      .eq("period_start", period.start)
      .eq("period_end", period.end)
      .single();
    expect(snap).toBeTruthy();
    expect(snap!.unit).toBe("completed_assessment");
    expect(Number(snap!.unit_price_cents)).toBe(2500);
    expect(Number(snap!.amount_cents)).toBe(Number(snap!.quantity) * 2500);

    // Re-run must not create a second snapshot for the same period.
    await runUsageBilling(now);
    const { count } = await db
      .from("billing_usage_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("billing_account_id", created.accountId)
      .eq("period_start", period.start);
    expect(count).toBe(1);
  }, 45_000);
});
