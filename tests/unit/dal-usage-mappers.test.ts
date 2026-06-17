import { describe, expect, it } from "vitest";

import { aggregateClientUsage } from "@/lib/dal/usage-mappers";

describe("aggregateClientUsage", () => {
  it("rolls campaigns up per client, including clients with no campaigns", () => {
    const rows = aggregateClientUsage(
      [
        { id: "c1", name: "Acme", isActive: true },
        { id: "c2", name: "Beta", isActive: true },
        { id: "c3", name: "Idle", isActive: false },
      ],
      [
        { clientId: "c1", status: "active", participantCount: 10, completedCount: 6, activityAt: "2026-06-01T00:00:00Z" },
        { clientId: "c1", status: "closed", participantCount: 5, completedCount: 5, activityAt: "2026-06-10T00:00:00Z" },
        { clientId: "c2", status: "draft", participantCount: 0, completedCount: 0, activityAt: "2026-05-01T00:00:00Z" },
        // Null client_id (e.g. partner-only campaign) must be ignored.
        { clientId: null, status: "active", participantCount: 99, completedCount: 99, activityAt: "2026-06-20T00:00:00Z" },
      ],
    );

    const acme = rows.find((r) => r.clientId === "c1")!;
    expect(acme).toMatchObject({
      campaignsTotal: 2,
      campaignsActive: 1,
      participantsInvited: 15,
      assessmentsCompleted: 11,
      lastActivityAt: "2026-06-10T00:00:00Z",
    });
    expect(acme.completionRate).toBeCloseTo(11 / 15);

    const beta = rows.find((r) => r.clientId === "c2")!;
    expect(beta.participantsInvited).toBe(0);
    expect(beta.completionRate).toBeNull();

    const idle = rows.find((r) => r.clientId === "c3")!;
    expect(idle.campaignsTotal).toBe(0);
    expect(idle.lastActivityAt).toBeNull();

    // Sorted by assessments completed (desc); the null-client row is excluded.
    expect(rows[0].clientId).toBe("c1");
    expect(rows).toHaveLength(3);
  });
});
