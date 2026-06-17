import { describe, expect, it } from "vitest";

import { stripeInvoiceToUpdate } from "@/lib/dal/billing-mappers";

// Minimal Stripe.Invoice-shaped fixtures; only the fields the mapper reads.
function invoice(overrides: Record<string, unknown>) {
  return {
    number: "TRJ-0001",
    subtotal: 100000,
    total: 110000,
    amount_due: 110000,
    amount_paid: 0,
    hosted_invoice_url: "https://invoice.stripe.test/x",
    invoice_pdf: null,
    status_transitions: {},
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("stripeInvoiceToUpdate", () => {
  it("maps a paid invoice with paid_at and tax = total - subtotal", () => {
    const update = stripeInvoiceToUpdate(
      invoice({
        status: "paid",
        amount_paid: 110000,
        amount_due: 0,
        status_transitions: { paid_at: 1781000000 },
      }),
    );
    expect(update.status).toBe("paid");
    expect(update.taxCents).toBe(10000);
    expect(update.amountPaidCents).toBe(110000);
    expect(update.paidAt).toBe(new Date(1781000000 * 1000).toISOString());
    expect(update.voidedAt).toBeNull();
  });

  it("maps a void invoice and records voided_at", () => {
    const update = stripeInvoiceToUpdate(
      invoice({ status: "void", status_transitions: { voided_at: 1781000500 } }),
    );
    expect(update.status).toBe("void");
    expect(update.voidedAt).toBe(new Date(1781000500 * 1000).toISOString());
  });

  it("falls back to draft for unknown/unsupported statuses", () => {
    const update = stripeInvoiceToUpdate(invoice({ status: "deleted" }));
    expect(update.status).toBe("draft");
  });
});
