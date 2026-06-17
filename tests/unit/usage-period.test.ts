import { describe, expect, it } from "vitest";

import {
  computeUsageAmountCents,
  previousMonthPeriod,
} from "@/lib/billing/usage-period";

describe("previousMonthPeriod", () => {
  it("returns the calendar month before now (UTC), end-exclusive", () => {
    const period = previousMonthPeriod(new Date("2026-07-01T02:00:00Z"));
    expect(period.start).toBe("2026-06-01T00:00:00.000Z");
    expect(period.end).toBe("2026-07-01T00:00:00.000Z");
    expect(period.label).toBe("June 2026");
  });

  it("handles the January → previous December year rollover", () => {
    const period = previousMonthPeriod(new Date("2026-01-15T00:00:00Z"));
    expect(period.start).toBe("2025-12-01T00:00:00.000Z");
    expect(period.end).toBe("2026-01-01T00:00:00.000Z");
    expect(period.label).toBe("December 2025");
  });
});

describe("computeUsageAmountCents", () => {
  it("multiplies quantity by unit price and floors at zero", () => {
    expect(computeUsageAmountCents(12, 2500)).toBe(30000);
    expect(computeUsageAmountCents(0, 2500)).toBe(0);
    expect(computeUsageAmountCents(-3, 2500)).toBe(0);
  });
});
