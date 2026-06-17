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
  InvoiceKind,
  InvoiceLineItem,
  InvoiceStatus,
} from "@/types/database";

/**
 * Reuse the account's Stripe customer, creating + storing one on first use.
 * When reusing, the customer's name/email/address are re-synced from the latest
 * saved billing details — otherwise a billing email changed after the first
 * invoice would leave Stripe emailing the next invoice to the old address.
 */
async function ensureStripeCustomer(account: BillingAccount): Promise<string> {
  const stripe = getStripe();
  const fields = {
    name: account.legalName ?? undefined,
    email: account.billingEmail ?? undefined,
    address: account.country ? { country: account.country } : undefined,
  };

  if (account.stripeCustomerId) {
    await stripe.customers.update(account.stripeCustomerId, fields);
    return account.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    ...fields,
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

/**
 * Shared issuance path: create a draft invoice, attach line items, finalize and
 * send via Stripe (card + bank transfer per the account's enabled methods),
 * then mirror it locally. Used by both one-off and usage invoices.
 *
 * GST: `automatic_tax` is intentionally left off until Stripe Tax is configured
 * for the AU account (enabling it before then makes finalize fail). Once Tax is
 * live, set `automatic_tax: { enabled: true }` on the draft.
 */
async function issueInvoice(
  account: BillingAccount,
  kind: InvoiceKind,
  lineItems: InvoiceLineItem[],
  memo: string | null,
): Promise<Invoice> {
  if (!account.billingEmail) {
    throw new Error("Add a billing email to the account before sending an invoice.");
  }
  if (lineItems.length === 0) {
    throw new Error("An invoice needs at least one line item.");
  }

  const stripe = getStripe();
  const customerId = await ensureStripeCustomer(account);

  const draft = await stripe.invoices.create({
    customer: customerId,
    collection_method: "send_invoice",
    days_until_due: account.paymentTermsDays,
    currency: account.currency,
    auto_advance: false,
    description: memo ?? undefined,
    metadata: { billing_account_id: account.id, kind },
  });

  const invoiceId = draft.id;
  if (!invoiceId) {
    throw new Error("Stripe did not return an invoice id.");
  }

  for (const item of lineItems) {
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
    kind,
    stripeInvoiceId: invoiceId,
    number: sent.number ?? null,
    status: toLocalStatus(sent.status),
    currency: sent.currency ?? account.currency,
    subtotalCents: subtotal,
    taxCents: Math.max(0, total - subtotal),
    totalCents: total,
    amountDueCents: sent.amount_due ?? 0,
    amountPaidCents: sent.amount_paid ?? 0,
    description: sent.description ?? memo ?? null,
    lineItems,
    hostedInvoiceUrl: sent.hosted_invoice_url ?? null,
    invoicePdfUrl: sent.invoice_pdf ?? null,
    dueAt: unixToIso(sent.due_date),
    issuedAt:
      unixToIso(sent.status_transitions?.finalized_at) ??
      new Date().toISOString(),
  });
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

/** Create + send a one-off (consultancy) invoice for a client. */
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

  return issueInvoice(account, "one_off", input.lineItems, input.memo ?? null);
}

/**
 * Create + send a usage invoice for an already-resolved billing account. Called
 * by the monthly usage-billing cron with a single computed line item.
 */
export async function createUsageInvoice(
  account: BillingAccount,
  lineItem: InvoiceLineItem,
  memo: string | null,
): Promise<Invoice> {
  return issueInvoice(account, "usage", [lineItem], memo);
}
