import { describe, expect, it } from "vitest";
import { resolveUsagePeriod } from "@/lib/usage/period";
import {
  aggregateUsageReport,
  usageReportCsv,
  type UsageEvent,
} from "@/lib/usage/report";
const now = new Date("2026-10-06T04:00:00Z");
const period = resolveUsagePeriod({ period: "last-month" }, now);
const clients = [
  { id: "c1", name: "Client One", slug: "one", partnerId: "p1" },
  { id: "c2", name: "Idle Client", slug: "idle", partnerId: "p1" },
];
const partners = [{ id: "p1", name: "Partner One", slug: "partner-one" }];
const campaigns = [
  { id: "a", name: "Campaign A", clientId: "c1", partnerId: "stale-partner" },
  { id: "b", name: "Partner campaign", clientId: null, partnerId: "p1" },
];
const events: UsageEvent[] = [
  { campaignId: "a", kind: "added", at: "2026-08-31T23:59:59Z" },
  { campaignId: "a", kind: "started", at: "2026-09-01T00:00:00Z" },
  { campaignId: "a", kind: "completed", at: "2026-09-30T23:59:59Z" },
  { campaignId: "a", kind: "completed", at: "2026-10-01T00:00:00Z" },
  { campaignId: "b", kind: "completed", at: "2026-09-15T12:00:00Z" },
];

describe("usage report aggregation", () => {
  it("uses each event's date with inclusive start and exclusive end", () => {
    const report = aggregateUsageReport(
      period,
      clients,
      partners,
      campaigns,
      events,
      now,
    );
    expect(report.totals).toEqual({ added: 0, started: 1, completed: 2 });
    expect(report.trend.reduce((sum, point) => sum + point.value, 0)).toBe(
      report.totals.completed,
    );
    expect(report.trend).toHaveLength(30);
    expect(
      report.trend.find((point) => point.key === "2026-09-02")?.value,
    ).toBe(0);
  });
  it("includes idle clients and partner-owned work once, using the current client relationship", () => {
    const report = aggregateUsageReport(
      period,
      clients,
      partners,
      campaigns,
      events,
      now,
    );
    expect(report.clients.find((client) => client.id === "c2")?.completed).toBe(
      0,
    );
    expect(
      report.clients.find((client) => client.id === "partner-owned:p1")
        ?.completed,
    ).toBe(1);
    expect(report.partners).toHaveLength(1);
    expect(report.partners[0]).toMatchObject({ id: "p1", completed: 2 });
    for (const group of ["clients", "partners", "campaigns"] as const)
      expect(report[group].reduce((sum, row) => sum + row.completed, 0)).toBe(
        report.totals.completed,
      );
  });
  it("discards unknown campaigns and future timestamps; open-period trend stops today", () => {
    const report = aggregateUsageReport(
      resolveUsagePeriod({}, now),
      clients,
      partners,
      campaigns,
      [
        { campaignId: "unknown", kind: "completed", at: now.toISOString() },
        { campaignId: "a", kind: "completed", at: "2026-10-31T00:00:00Z" },
      ],
      now,
    );
    expect(report.totals.completed).toBe(0);
    expect(report.trend.at(-1)?.key).toBe("2026-10-06");
  });
  it("uses monthly buckets for long periods and preserves missing months", () => {
    const report = aggregateUsageReport(
      resolveUsagePeriod(
        { period: "custom", from: "2026-01-01", to: "2026-09-30" },
        now,
      ),
      clients,
      partners,
      campaigns,
      events,
      now,
    );
    expect(report.trendInterval).toBe("month");
    expect(report.trend).toHaveLength(9);
    expect(report.trend[0]).toMatchObject({ key: "2026-01", value: 0 });
  });
  it("keeps large portfolios accurate beyond 1,000 events", () => {
    const report = aggregateUsageReport(
      period,
      clients,
      partners,
      campaigns,
      Array.from({ length: 1501 }, () => ({
        campaignId: "a",
        kind: "completed",
        at: "2026-09-15T12:00:00Z",
      })),
      now,
    );
    expect(report.totals.completed).toBe(1501);
  });
  it("exports metadata, zeros and safe names without spreadsheet formulas", () => {
    const report = aggregateUsageReport(
      period,
      [{ ...clients[0], name: '=HYPERLINK("bad")' }],
      partners,
      [],
      [],
      now,
    );
    const csv = usageReportCsv(report, "clients", "Workspace");
    expect(csv).toContain('"UTC"');
    expect(csv).toContain('"Live activity; not an invoice"');
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"2026-10-01T00:00:00.000Z"');
    expect(csv).toContain('"Completed participant journey"');
  });
});
