import { describe, expect, it } from "vitest";
import { mapCampaignWithCountsRows } from "@/lib/dal/campaigns-mappers";

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
