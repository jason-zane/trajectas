import { afterAll, describe, expect, it } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { createOneOffInvoice } from "@/lib/stripe/invoices";

/**
 * End-to-end check of the one-off invoice flow: create + finalize + send via
 * Stripe and mirror to the local `invoices` table. This flow MUTATES Stripe
 * (it sends a real invoice), so it is gated to a TEST-mode key as well as a
 * local Supabase host — never run it against a live key or production DB.
 * It uses a throwaway client fixture and only deletes rows it created.
 * Run via: `npm run test:integration:local -- tests/integration/stripe-invoice-flow.test.ts`
 * with a test-mode STRIPE_SECRET_KEY exported.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const isLocalSupabase =
  !!SUPABASE_URL &&
  /^(https?:\/\/)?(127\.0\.0\.1|localhost|host\.docker\.internal|kong)(:\d+)?(\/|$)/.test(
    SUPABASE_URL,
  );
const isTestModeKey = /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY ?? "");
const canRun = isTestModeKey && isLocalSupabase;

describe.skipIf(!canRun)("one-off invoice flow (integration)", () => {
  const created: {
    clientId?: string;
    accountId?: string;
    stripeInvoiceId?: string;
  } = {};

  afterAll(async () => {
    const db = createAdminClient();
    if (created.stripeInvoiceId) {
      try {
        await getStripe().invoices.voidInvoice(created.stripeInvoiceId);
      } catch {
        // Already void/paid — nothing to clean up.
      }
    }
    if (created.accountId) {
      await db.from("invoices").delete().eq("billing_account_id", created.accountId);
      await db.from("billing_accounts").delete().eq("id", created.accountId);
    }
    if (created.clientId) {
      await db.from("clients").delete().eq("id", created.clientId);
    }
  });

  it("creates, finalizes and mirrors a Stripe invoice", async () => {
    const db = createAdminClient();
    const slug = `zz-invoice-test-${Date.now()}`;
    const { data: client, error: clientErr } = await db
      .from("clients")
      .insert({ name: "Invoice Test Co", slug, is_active: true })
      .select("id")
      .single();
    expect(clientErr).toBeNull();
    created.clientId = client!.id as string;

    const invoice = await createOneOffInvoice({
      clientId: created.clientId,
      legalName: "Invoice Test Co",
      billingEmail: "billing+test@trajectas.com",
      lineItems: [
        { description: "Advisory day", quantity: 2, unitAmountCents: 150000 },
        { description: "Workshop", quantity: 1, unitAmountCents: 80000 },
      ],
    });
    created.stripeInvoiceId = invoice.stripeInvoiceId ?? undefined;

    const { data: account } = await db
      .from("billing_accounts")
      .select("id")
      .eq("client_id", created.clientId)
      .single();
    created.accountId = account?.id as string;

    expect(invoice.stripeInvoiceId).toMatch(/^in_/);
    expect(invoice.status).toBe("open");
    expect(invoice.totalCents).toBe(380000);
    expect(invoice.hostedInvoiceUrl).toBeTruthy();

    const { data: mirrored } = await db
      .from("invoices")
      .select("status, total_cents")
      .eq("stripe_invoice_id", invoice.stripeInvoiceId!)
      .single();
    expect(mirrored?.total_cents).toBe(380000);
    expect(mirrored?.status).toBe("open");
  }, 30_000);
});
