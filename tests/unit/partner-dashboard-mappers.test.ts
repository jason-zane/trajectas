import { describe, expect, it } from "vitest";

import {
  bucketCompletionsByDay,
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
    // Strictly ascending — a sparkline reads left to right.
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

describe("bucketCompletionsByDay", () => {
  it("counts rows per UTC day and ignores rows with no completion", () => {
    const counts = bucketCompletionsByDay([
      { completed_at: "2026-09-01T10:00:00Z" },
      { completed_at: "2026-09-01T23:59:00Z" },
      { completed_at: "2026-09-02T00:01:00Z" },
      { completed_at: null },
      {},
    ]);
    expect(counts.get("2026-09-01")).toBe(2);
    expect(counts.get("2026-09-02")).toBe(1);
    expect(counts.size).toBe(2);
  });
});

describe("mapRecentResultRows", () => {
  const base = {
    id: "p1",
    email: "avery@example.test",
    first_name: "Avery",
    last_name: "Invited",
    status: "in_progress",
    campaign_id: "c1",
    created_at: "2026-09-01T09:00:00Z",
    campaigns: { title: "Leadership", client_id: "cl1", clients: { name: "Acme" } },
    participant_sessions: [],
  };

  it("carries the client name, which is what makes a portfolio list legible", () => {
    const [row] = mapRecentResultRows([base]);
    expect(row.clientName).toBe("Acme");
    expect(row.campaignTitle).toBe("Leadership");
  });

  it("falls back to the email when the participant has no name", () => {
    const [row] = mapRecentResultRows([
      { ...base, first_name: null, last_name: null },
    ]);
    expect(row.participantName).toBe("avery@example.test");
  });

  it("uses the most recent session for the activity time and id", () => {
    const [row] = mapRecentResultRows([
      {
        ...base,
        participant_sessions: [
          { id: "s-old", started_at: "2026-09-01T09:00:00Z", completed_at: null },
          { id: "s-new", started_at: "2026-09-03T09:00:00Z", completed_at: "2026-09-04T09:00:00Z" },
        ],
      },
    ]);
    expect(row.latestSessionId).toBe("s-new");
    expect(row.lastActivity).toBe("2026-09-04T09:00:00Z");
  });

  it("sorts newest first across participants", () => {
    const rows = mapRecentResultRows([
      { ...base, id: "older", created_at: "2026-09-01T09:00:00Z" },
      { ...base, id: "newer", created_at: "2026-09-05T09:00:00Z" },
    ]);
    expect(rows.map((r) => r.participantId)).toEqual(["newer", "older"]);
  });

  it("survives a missing campaign or client relation", () => {
    const [row] = mapRecentResultRows([{ ...base, campaigns: null }]);
    expect(row.campaignTitle).toBe("Unknown");
    expect(row.clientName).toBe("Unknown client");
  });
});
