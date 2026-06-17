import { describe, expect, it } from "vitest";

import {
  mapBillingAccountRow,
  mapInvoiceLineItems,
  mapInvoiceRow,
} from "@/lib/dal/billing-mappers";

describe("mapBillingAccountRow", () => {
  it("maps snake_case rows to the camelCase DTO with null-safe defaults", () => {
    const account = mapBillingAccountRow({
      id: "ba_1",
      client_id: "client_1",
      partner_id: null,
      stripe_customer_id: null,
      legal_name: "Acme Pty Ltd",
      billing_email: "accounts@acme.test",
      country: "AU",
      tax_id: null,
      payment_terms_days: 30,
      currency: "aud",
      settings: null,
      created_at: "2026-06-17T00:00:00Z",
      updated_at: "2026-06-17T00:00:00Z",
      deleted_at: null,
    });

    expect(account).toMatchObject({
      id: "ba_1",
      clientId: "client_1",
      partnerId: null,
      legalName: "Acme Pty Ltd",
      paymentTermsDays: 30,
      currency: "aud",
      settings: {},
      deletedAt: null,
    });
  });
});

describe("mapInvoiceLineItems", () => {
  it("returns an empty array for non-array input", () => {
    expect(mapInvoiceLineItems(null)).toEqual([]);
    expect(mapInvoiceLineItems(undefined)).toEqual([]);
    expect(mapInvoiceLineItems("nope")).toEqual([]);
  });

  it("coerces stored line items, tolerating both camel and snake amount keys", () => {
    expect(
      mapInvoiceLineItems([
        { description: "Advisory", quantity: 2, unitAmountCents: 50000 },
        { description: "Setup", unit_amount_cents: 25000 },
      ]),
    ).toEqual([
      { description: "Advisory", quantity: 2, unitAmountCents: 50000 },
      { description: "Setup", quantity: 1, unitAmountCents: 25000 },
    ]);
  });
});

describe("mapInvoiceRow", () => {
  it("maps amounts as numbers and parses line items", () => {
    const invoice = mapInvoiceRow({
      id: "inv_1",
      billing_account_id: "ba_1",
      stripe_invoice_id: "in_123",
      number: "TRJ-0001",
      kind: "one_off",
      status: "open",
      currency: "aud",
      subtotal_cents: "100000",
      tax_cents: 10000,
      total_cents: 110000,
      amount_due_cents: 110000,
      amount_paid_cents: 0,
      description: "June consulting",
      line_items: [{ description: "Advisory", quantity: 1, unitAmountCents: 100000 }],
      hosted_invoice_url: "https://invoice.stripe.test/in_123",
      invoice_pdf_url: null,
      metadata: null,
      due_at: null,
      issued_at: "2026-06-17T00:00:00Z",
      paid_at: null,
      voided_at: null,
      created_at: "2026-06-17T00:00:00Z",
      updated_at: "2026-06-17T00:00:00Z",
    });

    expect(invoice.subtotalCents).toBe(100000);
    expect(invoice.taxCents).toBe(10000);
    expect(invoice.totalCents).toBe(110000);
    expect(invoice.status).toBe("open");
    expect(invoice.lineItems).toHaveLength(1);
    expect(invoice.metadata).toEqual({});
    expect(invoice.hostedInvoiceUrl).toBe("https://invoice.stripe.test/in_123");
  });
});
