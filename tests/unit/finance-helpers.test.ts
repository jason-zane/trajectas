import { describe, expect, it } from "vitest";

import {
  monthlySeries,
  summarizeInvoices,
  toMonthKey,
} from "@/lib/business/finance-helpers";
import type { Invoice } from "@/types/database";

function invoice(p: Partial<Invoice>): Invoice {
  return {
    id: "i", billingAccountId: "ba", stripeInvoiceId: null, number: null,
    kind: "one_off", status: "open", currency: "aud",
    subtotalCents: 0, taxCents: 0, totalCents: 0, amountDueCents: 0, amountPaidCents: 0,
    description: null, lineItems: [], hostedInvoiceUrl: null, invoicePdfUrl: null,
    metadata: {}, dueAt: null, issuedAt: null, paidAt: null, voidedAt: null,
    created_at: "2026-06-01T00:00:00Z", updated_at: "2026-06-01T00:00:00Z",
    ...p,
  };
}

describe("monthlySeries", () => {
  it("builds a contiguous oldest→newest series ending at now, filling gaps", () => {
    const series = monthlySeries(
      new Map([["2026-06", 30], ["2026-04", 10]]),
      6,
      new Date("2026-06-17T00:00:00Z"),
    );
    expect(series.map((s) => s.key)).toEqual([
      "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
    ]);
    expect(series.map((s) => s.value)).toEqual([0, 0, 0, 10, 0, 30]);
    expect(series[5].label).toBe("Jun");
  });
});

describe("summarizeInvoices", () => {
  const now = new Date("2026-06-17T00:00:00Z");
  it("sums AR from open invoices and splits this-month invoiced/paid", () => {
    const s = summarizeInvoices(
      [
        invoice({ status: "open", amountDueCents: 50000, totalCents: 50000, issuedAt: "2026-06-02T00:00:00Z" }),
        invoice({ status: "paid", totalCents: 30000, amountPaidCents: 30000, issuedAt: "2026-06-03T00:00:00Z", paidAt: "2026-06-10T00:00:00Z" }),
        invoice({ status: "open", amountDueCents: 20000, totalCents: 20000, issuedAt: "2026-05-20T00:00:00Z" }),
      ],
      now,
    );
    expect(s.outstandingCents).toBe(70000); // both open
    expect(s.invoicedThisMonthCents).toBe(80000); // 50k + 30k issued in June
    expect(s.paidThisMonthCents).toBe(30000);
    const june = s.invoicedTrend.find((p) => p.key === "2026-06");
    const may = s.invoicedTrend.find((p) => p.key === "2026-05");
    expect(june?.value).toBe(80000);
    expect(may?.value).toBe(20000);
  });
});

describe("toMonthKey", () => {
  it("formats UTC year-month", () => {
    expect(toMonthKey(new Date("2026-01-09T23:00:00Z"))).toBe("2026-01");
  });
});
