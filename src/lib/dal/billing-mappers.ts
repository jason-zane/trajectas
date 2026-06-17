/**
 * Pure row → DTO transforms for the billing DAL.
 *
 * I/O-free (no Supabase, no `server-only`) so the mapping logic is unit-tested
 * independently of the query functions in `billing.ts`. See README.md.
 */
import type {
  BillingAccount,
  Invoice,
  InvoiceKind,
  InvoiceLineItem,
  InvoiceStatus,
} from "@/types/database";

type Row = Record<string, unknown>;

const toNumber = (value: unknown): number =>
  value === null || value === undefined ? 0 : Number(value);

export function mapBillingAccountRow(row: Row): BillingAccount {
  return {
    id: String(row.id),
    clientId: (row.client_id as string | null) ?? null,
    partnerId: (row.partner_id as string | null) ?? null,
    stripeCustomerId: (row.stripe_customer_id as string | null) ?? null,
    legalName: (row.legal_name as string | null) ?? null,
    billingEmail: (row.billing_email as string | null) ?? null,
    country: String(row.country),
    taxId: (row.tax_id as string | null) ?? null,
    paymentTermsDays: toNumber(row.payment_terms_days),
    currency: String(row.currency),
    settings: (row.settings as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    deletedAt: (row.deleted_at as string | null) ?? null,
  };
}

export function mapInvoiceLineItems(value: unknown): InvoiceLineItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const item = (entry ?? {}) as Row;
    return {
      description: String(item.description ?? ""),
      quantity: toNumber(item.quantity ?? 1),
      unitAmountCents: toNumber(item.unitAmountCents ?? item.unit_amount_cents),
    };
  });
}

export function mapInvoiceRow(row: Row): Invoice {
  return {
    id: String(row.id),
    billingAccountId: String(row.billing_account_id),
    stripeInvoiceId: (row.stripe_invoice_id as string | null) ?? null,
    number: (row.number as string | null) ?? null,
    kind: row.kind as InvoiceKind,
    status: row.status as InvoiceStatus,
    currency: String(row.currency),
    subtotalCents: toNumber(row.subtotal_cents),
    taxCents: toNumber(row.tax_cents),
    totalCents: toNumber(row.total_cents),
    amountDueCents: toNumber(row.amount_due_cents),
    amountPaidCents: toNumber(row.amount_paid_cents),
    description: (row.description as string | null) ?? null,
    lineItems: mapInvoiceLineItems(row.line_items),
    hostedInvoiceUrl: (row.hosted_invoice_url as string | null) ?? null,
    invoicePdfUrl: (row.invoice_pdf_url as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    dueAt: (row.due_at as string | null) ?? null,
    issuedAt: (row.issued_at as string | null) ?? null,
    paidAt: (row.paid_at as string | null) ?? null,
    voidedAt: (row.voided_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}
