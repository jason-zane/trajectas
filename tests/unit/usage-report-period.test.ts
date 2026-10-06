import { describe, expect, it } from "vitest";
import {
  adjacentUsageMonth,
  resolveUsagePeriod,
  usagePeriodQuery,
} from "@/lib/usage/period";
const now = new Date("2026-10-06T04:00:00Z");

describe("usage report periods", () => {
  it("defaults reporting to the UTC calendar month, billing to the last closed month", () => {
    expect(resolveUsagePeriod({}, now)).toMatchObject({
      start: "2026-10-01T00:00:00.000Z",
      end: "2026-11-01T00:00:00.000Z",
      from: "2026-10-01",
      to: "2026-10-31",
      isOpen: true,
    });
    expect(resolveUsagePeriod({}, now, "last-month")).toMatchObject({
      start: "2026-09-01T00:00:00.000Z",
      end: "2026-10-01T00:00:00.000Z",
      isOpen: false,
    });
  });
  it("handles year boundaries, leap months and quarter boundaries", () => {
    expect(
      resolveUsagePeriod(
        { period: "last-month" },
        new Date("2026-01-01T00:00:00Z"),
      ),
    ).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
    expect(
      resolveUsagePeriod({ period: "month", month: "2024-02" }, now).to,
    ).toBe("2024-02-29");
    expect(resolveUsagePeriod({ period: "quarter" }, now)).toMatchObject({
      from: "2026-10-01",
      to: "2026-12-31",
      label: "Q4 2026",
    });
  });
  it("includes the full final custom day and serializes the selection", () => {
    const period = resolveUsagePeriod(
      { period: "custom", from: "2026-09-10", to: "2026-09-10" },
      now,
    );
    expect(period.end).toBe("2026-09-11T00:00:00.000Z");
    expect(usagePeriodQuery(period)).toBe(
      "period=custom&from=2026-09-10&to=2026-09-10",
    );
  });
  it.each([
    { period: "month", month: "2026-13" },
    { period: "month", month: "2026-2" },
    { period: "custom", from: "2026-02-30", to: "2026-03-02" },
    { period: "custom", from: "2026-09-30", to: "2026-09-01" },
    { period: "custom", from: ["2026-09-01"], to: "2026-09-30" },
    { period: "invalid" },
  ])(
    "rejects malformed dates/ranges without querying an unbounded period: %j",
    (params) => {
      expect(resolveUsagePeriod(params, now)).toMatchObject({
        preset: "this-month",
        start: "2026-10-01T00:00:00.000Z",
      });
      expect(resolveUsagePeriod(params, now).error).toBeTruthy();
    },
  );
  it("has explicit all-time bounds and supports adjacent months across years", () => {
    expect(resolveUsagePeriod({ period: "all" }, now)).toMatchObject({
      start: null,
      end: null,
      label: "All time",
    });
    expect(
      adjacentUsageMonth(
        resolveUsagePeriod({ period: "month", month: "2026-01" }, now),
        -1,
      ),
    ).toBe("2025-12");
  });
});
