import { describe, expect, it } from "vitest";
import {
  mapCampaignSessionRows,
  mapCampaignWithCountsRows,
} from "@/lib/dal/campaigns-mappers";

const baseRow = {
  id: "c1",
  title: "Q1 Launch",
  slug: "q1-launch",
  status: "active",
  client_id: "client-1",
  allow_resume: true,
  show_progress: true,
  randomize_assessment_order: false,
  created_at: "2026-01-01T00:00:00Z",
};

describe("mapCampaignWithCountsRows", () => {
  it("threads the inlined counts and embedded client name through", () => {
    const [c] = mapCampaignWithCountsRows([
      {
        ...baseRow,
        assessment_count: 3,
        participant_count: 12,
        completed_count: 5,
        clients: { name: "Acme Corp" },
      },
    ]);

    expect(c).toMatchObject({
      id: "c1",
      title: "Q1 Launch",
      slug: "q1-launch",
      assessmentCount: 3,
      participantCount: 12,
      completedCount: 5,
      clientName: "Acme Corp",
    });
  });

  it("defaults missing counts to 0 and client name to undefined", () => {
    const [c] = mapCampaignWithCountsRows([{ ...baseRow }]);
    expect(c.assessmentCount).toBe(0);
    expect(c.participantCount).toBe(0);
    expect(c.completedCount).toBe(0);
    expect(c.clientName).toBeUndefined();
  });

  it("returns [] for nullish input", () => {
    // @ts-expect-error exercising the nullish guard
    expect(mapCampaignWithCountsRows(null)).toEqual([]);
    expect(mapCampaignWithCountsRows([])).toEqual([]);
  });
});

describe("mapCampaignSessionRows", () => {
  // Input is oldest-first by started_at (as the query returns it).
  const rows = [
    {
      id: "s1",
      status: "completed",
      started_at: "2026-01-01T00:00:00Z",
      completed_at: "2026-01-01T01:00:00Z",
      assessment_id: "a1",
      campaign_participant_id: "cp1",
      assessments: { id: "a1", title: "Numerical" },
      campaign_participants: {
        id: "cp1",
        email: "alice@example.com",
        first_name: "Alice",
        last_name: "Smith",
      },
    },
    {
      id: "s2",
      status: "in_progress",
      started_at: "2026-01-02T00:00:00Z",
      completed_at: null,
      assessment_id: "a1",
      campaign_participant_id: "cp1",
      // embedded relations returned as single-element arrays (PostgREST form)
      assessments: [{ id: "a1", title: "Numerical" }],
      campaign_participants: [
        {
          id: "cp1",
          email: "alice@example.com",
          first_name: "Alice",
          last_name: "Smith",
        },
      ],
    },
  ];

  it("numbers attempts chronologically per (participant, assessment)", () => {
    const out = mapCampaignSessionRows(rows);
    const byId = Object.fromEntries(out.map((r) => [r.id, r]));
    expect(byId.s1.attemptNumber).toBe(1);
    expect(byId.s2.attemptNumber).toBe(2);
    expect(byId.s1.participantName).toBe("Alice Smith");
    expect(byId.s1.assessmentTitle).toBe("Numerical");
  });

  it("sorts newest first by completed-or-started date", () => {
    const out = mapCampaignSessionRows(rows);
    // s2 started later (2026-01-02) than s1 completed (2026-01-01) → s2 first
    expect(out.map((r) => r.id)).toEqual(["s2", "s1"]);
  });

  it("falls back name → email → Unknown, and unset titles", () => {
    const out = mapCampaignSessionRows([
      {
        id: "x",
        status: "completed",
        started_at: null,
        completed_at: null,
        assessment_id: "a9",
        campaign_participant_id: "cp9",
        assessments: null,
        campaign_participants: {
          id: "cp9",
          email: "bob@example.com",
          first_name: null,
          last_name: null,
        },
      },
    ]);
    expect(out[0].participantName).toBe("bob@example.com");
    expect(out[0].assessmentTitle).toBe("Untitled assessment");
  });

  it("returns [] for nullish input", () => {
    // @ts-expect-error exercising the nullish guard
    expect(mapCampaignSessionRows(null)).toEqual([]);
  });
});
