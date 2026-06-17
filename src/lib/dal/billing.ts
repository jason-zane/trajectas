import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { throwActionError } from "@/lib/security/action-errors";
import {
  mapBillingAccountRow,
  mapInvoiceRow,
  type InvoiceMirrorUpdate,
} from "@/lib/dal/billing-mappers";
import type {
  BillingAccount,
  BillingClientOption,
  Invoice,
  InvoiceKind,
  InvoiceLineItem,
  InvoiceListItem,
  InvoiceStatus,
} from "@/types/database";

const BILLING_ACCOUNT_COLUMNS =
  "id, client_id, partner_id, stripe_customer_id, legal_name, billing_email, country, tax_id, payment_terms_days, currency, usage_billing_enabled, usage_unit, usage_unit_price_cents, settings, created_at, updated_at, deleted_at";

export async function getBillingAccountByClientId(
  clientId: string,
): Promise<BillingAccount | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("billing_accounts")
    .select(BILLING_ACCOUNT_COLUMNS)
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throwActionError(
      "getBillingAccountByClientId",
      "Unable to load the billing account.",
      error,
    );
  }
  return data ? mapBillingAccountRow(data) : null;
}

export async function getBillingAccountById(
  id: string,
): Promise<BillingAccount | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("billing_accounts")
    .select(BILLING_ACCOUNT_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throwActionError(
      "getBillingAccountById",
      "Unable to load the billing account.",
      error,
    );
  }
  return data ? mapBillingAccountRow(data) : null;
}

export interface EnsureBillingAccountInput {
  clientId: string;
  legalName?: string | null;
  billingEmail?: string | null;
  country?: string;
  taxId?: string | null;
  paymentTermsDays?: number;
  currency?: string;
}

/**
 * Find the client's billing account, creating one if absent. When billing
 * details are supplied they are refreshed on the existing account so the next
 * invoice uses the latest entity name / email.
 */
export async function ensureBillingAccountForClient(
  input: EnsureBillingAccountInput,
): Promise<BillingAccount> {
  const db = createAdminClient();
  const existing = await getBillingAccountByClientId(input.clientId);

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (input.legalName !== undefined) patch.legal_name = input.legalName;
    if (input.billingEmail !== undefined) patch.billing_email = input.billingEmail;
    if (input.taxId !== undefined) patch.tax_id = input.taxId;
    if (input.paymentTermsDays !== undefined)
      patch.payment_terms_days = input.paymentTermsDays;
    if (Object.keys(patch).length === 0) return existing;

    const { data, error } = await db
      .from("billing_accounts")
      .update(patch)
      .eq("id", existing.id)
      .select(BILLING_ACCOUNT_COLUMNS)
      .single();
    if (error || !data) {
      throwActionError(
        "ensureBillingAccountForClient",
        "Unable to update the billing account.",
        error,
      );
    }
    return mapBillingAccountRow(data);
  }

  const { data, error } = await db
    .from("billing_accounts")
    .insert({
      client_id: input.clientId,
      legal_name: input.legalName ?? null,
      billing_email: input.billingEmail ?? null,
      country: input.country ?? "AU",
      tax_id: input.taxId ?? null,
      payment_terms_days: input.paymentTermsDays ?? 14,
      currency: input.currency ?? "aud",
    })
    .select(BILLING_ACCOUNT_COLUMNS)
    .single();
  if (error || !data) {
    throwActionError(
      "ensureBillingAccountForClient",
      "Unable to create the billing account.",
      error,
    );
  }
  return mapBillingAccountRow(data);
}

export async function setBillingAccountStripeCustomer(
  id: string,
  stripeCustomerId: string,
): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("billing_accounts")
    .update({ stripe_customer_id: stripeCustomerId })
    .eq("id", id);
  if (error) {
    throwActionError(
      "setBillingAccountStripeCustomer",
      "Unable to link the Stripe customer.",
      error,
    );
  }
}

export interface UpsertInvoiceInput {
  billingAccountId: string;
  kind: InvoiceKind;
  stripeInvoiceId: string;
  number: string | null;
  status: InvoiceStatus;
  currency: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  amountDueCents: number;
  amountPaidCents: number;
  description: string | null;
  lineItems: InvoiceLineItem[];
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  dueAt: string | null;
  issuedAt: string | null;
}

/** Insert or update the local mirror of a Stripe invoice (keyed by Stripe id). */
export async function upsertInvoiceFromStripe(
  input: UpsertInvoiceInput,
): Promise<Invoice> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("invoices")
    .upsert(
      {
        billing_account_id: input.billingAccountId,
        stripe_invoice_id: input.stripeInvoiceId,
        number: input.number,
        kind: input.kind,
        status: input.status,
        currency: input.currency,
        subtotal_cents: input.subtotalCents,
        tax_cents: input.taxCents,
        total_cents: input.totalCents,
        amount_due_cents: input.amountDueCents,
        amount_paid_cents: input.amountPaidCents,
        description: input.description,
        line_items: input.lineItems,
        hosted_invoice_url: input.hostedInvoiceUrl,
        invoice_pdf_url: input.invoicePdfUrl,
        due_at: input.dueAt,
        issued_at: input.issuedAt,
        paid_at: input.status === "paid" ? new Date().toISOString() : null,
      },
      { onConflict: "stripe_invoice_id" },
    )
    .select("*")
    .single();
  if (error || !data) {
    throwActionError(
      "upsertInvoiceFromStripe",
      "Unable to record the invoice.",
      error,
    );
  }
  return mapInvoiceRow(data);
}

export async function listInvoicesForAdmin(): Promise<InvoiceListItem[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("invoices")
    .select("*, billing_accounts(legal_name, clients(name))")
    .order("created_at", { ascending: false });
  if (error) {
    throwActionError("listInvoicesForAdmin", "Unable to load invoices.", error);
  }
  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    const account = record.billing_accounts as
      | { legal_name?: string | null; clients?: { name?: string | null } | null }
      | null
      | undefined;
    const accountLabel =
      account?.clients?.name ?? account?.legal_name ?? "Unknown account";
    return { ...mapInvoiceRow(record), accountLabel };
  });
}

export async function listBillingClients(): Promise<BillingClientOption[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("clients")
    .select("id, name")
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) {
    throwActionError("listBillingClients", "Unable to load clients.", error);
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
  }));
}

/**
 * Apply a Stripe-webhook-derived status/amount update to the local mirror,
 * keyed by Stripe invoice id. Returns false when we hold no matching invoice
 * (e.g. one created outside our flow) so the webhook can ack and move on.
 */
export async function applyInvoiceWebhookUpdate(
  stripeInvoiceId: string,
  update: InvoiceMirrorUpdate,
): Promise<boolean> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("invoices")
    .update({
      status: update.status,
      number: update.number,
      subtotal_cents: update.subtotalCents,
      tax_cents: update.taxCents,
      total_cents: update.totalCents,
      amount_due_cents: update.amountDueCents,
      amount_paid_cents: update.amountPaidCents,
      hosted_invoice_url: update.hostedInvoiceUrl,
      invoice_pdf_url: update.invoicePdfUrl,
      paid_at: update.paidAt,
      voided_at: update.voidedAt,
    })
    .eq("stripe_invoice_id", stripeInvoiceId)
    .select("id")
    .maybeSingle();
  if (error) {
    throwActionError(
      "applyInvoiceWebhookUpdate",
      "Unable to update invoice from webhook.",
      error,
    );
  }
  return Boolean(data);
}
