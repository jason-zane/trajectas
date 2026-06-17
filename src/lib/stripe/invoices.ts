import "server-only";
import type Stripe from "stripe";

import { getStripe } from "./client";
import {
  ensureBillingAccountForClient,
  setBillingAccountStripeCustomer,
  upsertInvoiceFromStripe,
} from "@/lib/dal/billing";
import type {
  BillingAccount,
  Invoice,
  InvoiceLineItem,
  InvoiceStatus,
} from "@/types/database";

/** Reuse the account's Stripe customer, creating + storing one on first use. */
async function ensureStripeCustomer(account: BillingAccount): Promise<string> {
  if (account.stripeCustomerId) return account.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: account.legalName ?? undefined,
    email: account.billingEmail ?? undefined,
    address: account.country ? { country: account.country } : undefined,
    metadata: {
      billing_account_id: account.id,
      client_id: account.clientId ?? "",
    },
  });
  await setBillingAccountStripeCustomer(account.id, customer.id);
  return customer.id;
}

function toLocalStatus(status: Stripe.Invoice.Status | null): InvoiceStatus {
  switch (status) {
    case "open":
    case "paid":
    case "void":
    case "uncollectible":
      return status;
    default:
      return "draft";
  }
}

function unixToIso(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

export interface CreateOneOffInvoiceInput {
  clientId: string;
  legalName?: string | null;
  billingEmail?: string | null;
  taxId?: string | null;
  paymentTermsDays?: number;
  memo?: string | null;
  lineItems: InvoiceLineItem[];
}

/**
 * Create, finalize and send a one-off (consultancy) invoice via Stripe, then
 * mirror it locally. Stripe emails a hosted, payable invoice; the customer can
 * pay by card or bank transfer per the methods enabled on the Stripe account.
 *
 * GST: `automatic_tax` is intentionally left off until Stripe Tax is configured
 * for the AU account (enabling it before then makes finalize fail). Once Tax is
 * live, set `automatic_tax: { enabled: true }` on the draft and the GST split
 * flows through `subtotal`/`tax`/`total` automatically.
 */
export async function createOneOffInvoice(
  input: CreateOneOffInvoiceInput,
): Promise<Invoice> {
  if (!input.lineItems.length) {
    throw new Error("An invoice needs at least one line item.");
  }

  const account = await ensureBillingAccountForClient({
    clientId: input.clientId,
    legalName: input.legalName,
    billingEmail: input.billingEmail,
    taxId: input.taxId,
    paymentTermsDays: input.paymentTermsDays,
  });

  if (!account.billingEmail) {
    throw new Error("Add a billing email to the account before sending an invoice.");
  }

  const stripe = getStripe();
  const customerId = await ensureStripeCustomer(account);

  const draft = await stripe.invoices.create({
    customer: customerId,
    collection_method: "send_invoice",
    days_until_due: account.paymentTermsDays,
    currency: account.currency,
    auto_advance: false,
    description: input.memo ?? undefined,
    metadata: { billing_account_id: account.id, kind: "one_off" },
  });

  const invoiceId = draft.id;
  if (!invoiceId) {
    throw new Error("Stripe did not return an invoice id.");
  }

  for (const item of input.lineItems) {
    // invoiceItems take a total `amount` (inline price_data would require a
    // pre-existing Product), so multiply out and note the quantity in the label.
    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoiceId,
      currency: account.currency,
      description:
        item.quantity > 1
          ? `${item.description} (×${item.quantity})`
          : item.description,
      amount: item.unitAmountCents * item.quantity,
    });
  }

  await stripe.invoices.finalizeInvoice(invoiceId, { auto_advance: false });
  const sent = await stripe.invoices.sendInvoice(invoiceId);

  const subtotal = sent.subtotal ?? 0;
  const total = sent.total ?? 0;

  return upsertInvoiceFromStripe({
    billingAccountId: account.id,
    kind: "one_off",
    stripeInvoiceId: invoiceId,
    number: sent.number ?? null,
    status: toLocalStatus(sent.status),
    currency: sent.currency ?? account.currency,
    subtotalCents: subtotal,
    taxCents: Math.max(0, total - subtotal),
    totalCents: total,
    amountDueCents: sent.amount_due ?? 0,
    amountPaidCents: sent.amount_paid ?? 0,
    description: sent.description ?? input.memo ?? null,
    lineItems: input.lineItems,
    hostedInvoiceUrl: sent.hosted_invoice_url ?? null,
    invoicePdfUrl: sent.invoice_pdf ?? null,
    dueAt: unixToIso(sent.due_date),
    issuedAt: unixToIso(sent.status_transitions?.finalized_at) ?? new Date().toISOString(),
  });
}
