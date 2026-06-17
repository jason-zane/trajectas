/**
 * Stripe webhook endpoint.
 *
 * Keeps the local invoice mirror in sync with Stripe's source of truth: when an
 * invoice is finalized, paid, fails, is voided or marked uncollectible, the
 * matching `invoices` row is updated. The signature is verified against
 * STRIPE_WEBHOOK_SECRET, so only genuine Stripe deliveries are processed.
 *
 * Register the endpoint in Stripe (Developers → Webhooks) pointing at
 * `/api/webhooks/stripe` and copy its signing secret into STRIPE_WEBHOOK_SECRET.
 */

import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { applyInvoiceWebhookUpdate } from "@/lib/dal/billing";
import { stripeInvoiceToUpdate } from "@/lib/dal/billing-mappers";
import { getStripe } from "@/lib/stripe/client";
import { reportError } from "@/lib/observability/report-error";

export const runtime = "nodejs";

const HANDLED_EVENTS: ReadonlySet<string> = new Set([
  "invoice.finalized",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.marked_uncollectible",
  "invoice.voided",
]);

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook:stripe] STRIPE_WEBHOOK_SECRET not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature";
    return new Response(`Webhook signature verification failed: ${message}`, {
      status: 400,
    });
  }

  try {
    if (HANDLED_EVENTS.has(event.type)) {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.id) {
        const updated = await applyInvoiceWebhookUpdate(
          invoice.id,
          stripeInvoiceToUpdate(invoice),
        );
        return NextResponse.json({ received: true, type: event.type, updated });
      }
    }
    return NextResponse.json({ received: true, type: event.type, ignored: true });
  } catch (err) {
    await reportError(err, {
      source: "webhook.stripe",
      severity: "error",
      alert: true,
      context: { type: event.type },
    });
    return new Response("Webhook handler error", { status: 500 });
  }
}
