import { describe, expect, it } from "vitest";

import {
  mapCompletionTimelineRows,
  mapRecentResultRows,
  zeroFilledTimeline,
} from "@/lib/dal/partner-dashboard-mappers";

describe("zeroFilledTimeline", () => {
  it("returns one dense point per day, oldest first, ending today", () => {
    const points = zeroFilledTimeline(5);
    expect(points).toHaveLength(5);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    expect(points[4].day).toBe(today.toISOString().slice(0, 10));
    expect(points.every((p) => p.count === 0)).toBe(true);
    const days = points.map((p) => p.day);
    expect([...days].sort()).toEqual(days);
  });

  it("fills known counts and leaves the gaps at zero", () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const key = today.toISOString().slice(0, 10);
    const points = zeroFilledTimeline(3, new Map([[key, 7]]));
    expect(points.at(-1)).toEqual({ day: key, count: 7 });
    expect(points.slice(0, 2).every((p) => p.count === 0)).toBe(true);
  });
});

describe("mapCompletionTimelineRows", () => {
  it("keys per-day totals by date", () => {
    const counts = mapCompletionTimelineRows([
      { day: "2026-09-01", completions: 2 },
      { day: "2026-09-02", completions: 1 },
    ]);
    expect(counts.get("2026-09-01")).toBe(2);
    expect(counts.get("2026-09-02")).toBe(1);
    expect(counts.size).toBe(2);
  });

  it("reads bigint counts, which arrive as strings", () => {
    const counts = mapCompletionTimelineRows([
      { day: "2026-09-01", completions: "1200" },
    ]);
    expect(counts.get("2026-09-01")).toBe(1200);
  });

  it("tolerates a full timestamp and skips rows with no day", () => {
    const counts = mapCompletionTimelineRows([
      { day: "2026-09-01T00:00:00Z", completions: 3 },
      { day: null, completions: 9 },
      {},
    ]);
    expect(counts.get("2026-09-01")).toBe(3);
    expect(counts.size).toBe(1);
  });
});

describe("mapRecentResultRows", () => {
  const base = {
    participant_id: "p1",
    participant_name: "Avery Invited",
    participant_email: "avery@example.test",
    campaign_id: "c1",
    campaign_title: "Leadership",
    client_name: "Acme",
    latest_session_id: "s-new",
    status: "in_progress",
    last_activity: "2026-09-04T09:00:00Z",
  };

  it("carries the client name, which is what makes a portfolio list legible", () => {
    const [row] = mapRecentResultRows([base]);
    expect(row.clientName).toBe("Acme");
    expect(row.campaignTitle).toBe("Leadership");
    expect(row.latestSessionId).toBe("s-new");
    expect(row.lastActivity).toBe("2026-09-04T09:00:00Z");
  });

  it("falls back to the email when the participant has no name", () => {
    const [row] = mapRecentResultRows([
      { ...base, participant_name: null },
    ]);
    expect(row.participantName).toBe("avery@example.test");
  });

  it("preserves the order the projection returned", () => {
    // The database orders by activity and limits; re-sorting here is what the
    // old client-side version got wrong, so the mapper must not touch order.
    const rows = mapRecentResultRows([
      { ...base, participant_id: "newer", last_activity: "2026-09-05T09:00:00Z" },
      { ...base, participant_id: "older", last_activity: "2026-09-01T09:00:00Z" },
    ]);
    expect(rows.map((r) => r.participantId)).toEqual(["newer", "older"]);
  });

  it("survives a missing campaign or client relation", () => {
    const [row] = mapRecentResultRows([
      { ...base, campaign_title: null, client_name: null },
    ]);
    expect(row.campaignTitle).toBe("Unknown");
    expect(row.clientName).toBe("Unknown client");
  });

  it("leaves the session id undefined when there is no session yet", () => {
    const [row] = mapRecentResultRows([{ ...base, latest_session_id: null }]);
    expect(row.latestSessionId).toBeUndefined();
  });
});
