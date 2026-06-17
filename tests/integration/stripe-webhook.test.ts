import { afterAll, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { POST } from "@/app/api/webhooks/stripe/route";

/**
 * Drives the Stripe webhook end-to-end: build a signed `invoice.paid` event and
 * confirm the local mirror flips to paid. The signature is generated with a
 * test secret via the Stripe SDK, so no live API call is made — but getStripe()
 * needs a key, so this is gated on a test-mode key + local Supabase host.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const isLocalSupabase =
  !!SUPABASE_URL &&
  /^(https?:\/\/)?(127\.0\.0\.1|localhost|host\.docker\.internal|kong)(:\d+)?(\/|$)/.test(
    SUPABASE_URL,
  );
const isTestModeKey = /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY ?? "");
const canRun = isTestModeKey && isLocalSupabase;

const WEBHOOK_SECRET = "whsec_test_secret_for_integration";

describe.skipIf(!canRun)("stripe webhook (integration)", () => {
  const created: { clientId?: string; accountId?: string } = {};

  afterAll(async () => {
    const db = createAdminClient();
    if (created.accountId) {
      await db.from("invoices").delete().eq("billing_account_id", created.accountId);
      await db.from("billing_accounts").delete().eq("id", created.accountId);
    }
    if (created.clientId) {
      await db.from("clients").delete().eq("id", created.clientId);
    }
  });

  it("updates the local invoice when an invoice.paid event arrives", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
    const db = createAdminClient();

    const slug = `zz-webhook-test-${Date.now()}`;
    const { data: client } = await db
      .from("clients")
      .insert({ name: "Webhook Test Co", slug, is_active: true })
      .select("id")
      .single();
    created.clientId = client!.id as string;

    const { data: account } = await db
      .from("billing_accounts")
      .insert({ client_id: created.clientId, billing_email: "billing+webhook@trajectas.com" })
      .select("id")
      .single();
    created.accountId = account!.id as string;

    const stripeInvoiceId = `in_test_webhook_${Date.now()}`;
    await db.from("invoices").insert({
      billing_account_id: created.accountId,
      stripe_invoice_id: stripeInvoiceId,
      kind: "one_off",
      status: "open",
      currency: "aud",
      subtotal_cents: 380000,
      total_cents: 380000,
      amount_due_cents: 380000,
      amount_paid_cents: 0,
    });

    const event = {
      id: "evt_test_webhook",
      object: "event",
      type: "invoice.paid",
      data: {
        object: {
          id: stripeInvoiceId,
          object: "invoice",
          status: "paid",
          number: "TRJ-WEBHOOK",
          subtotal: 380000,
          total: 380000,
          amount_due: 0,
          amount_paid: 380000,
          hosted_invoice_url: "https://invoice.stripe.test/webhook",
          invoice_pdf: null,
          status_transitions: { paid_at: Math.floor(Date.now() / 1000) },
        },
      },
    };
    const payload = JSON.stringify(event);
    const signature = getStripe().webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    });

    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": signature },
        body: payload,
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { updated?: boolean };
    expect(body.updated).toBe(true);

    const { data: mirrored } = await db
      .from("invoices")
      .select("status, amount_paid_cents, paid_at")
      .eq("stripe_invoice_id", stripeInvoiceId)
      .single();
    expect(mirrored?.status).toBe("paid");
    expect(Number(mirrored?.amount_paid_cents)).toBe(380000);
    expect(mirrored?.paid_at).toBeTruthy();
  }, 20_000);
});
