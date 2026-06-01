import { describe, expect, it } from "vitest";
import {
  buildActivityEvents,
  groupResponses,
  mapSessionRows,
} from "@/lib/dal/participants-mappers";

describe("mapSessionRows", () => {
  it("maps a full row including nested scores", () => {
    const [s] = mapSessionRows([
      {
        id: "sess-1",
        assessment_id: "asmt-1",
        status: "completed",
        processing_status: "processed",
        processing_error: "boom",
        started_at: "2026-01-01T00:00:00Z",
        completed_at: "2026-01-02T00:00:00Z",
        processed_at: "2026-01-03T00:00:00Z",
        assessments: { title: "Cognitive" },
        participant_scores: [
          {
            factor_id: "f1",
            raw_score: "10",
            scaled_score: "5.5",
            percentile: "90",
            scoring_method: "irt",
            factors: { name: "Reasoning" },
          },
        ],
      },
    ]);

    expect(s).toMatchObject({
      id: "sess-1",
      assessmentId: "asmt-1",
      assessmentTitle: "Cognitive",
      status: "completed",
      processingStatus: "processed",
      processingError: "boom",
      startedAt: "2026-01-01T00:00:00Z",
      completedAt: "2026-01-02T00:00:00Z",
      processedAt: "2026-01-03T00:00:00Z",
    });
    expect(s.scores[0]).toEqual({
      factorId: "f1",
      factorName: "Reasoning",
      rawScore: 10,
      scaledScore: 5.5,
      percentile: 90,
      scoringMethod: "irt",
      itemsUsed: 0,
    });
  });

  it("applies fallbacks for missing nested fields", () => {
    const [s] = mapSessionRows([
      {
        id: "sess-2",
        assessment_id: "asmt-2",
        status: "in_progress",
        // no processing_status, no assessments, no scores
      },
    ]);
    expect(s.assessmentTitle).toBe("Untitled");
    expect(s.processingStatus).toBe("idle");
    expect(s.processingError).toBeUndefined();
    expect(s.scores).toEqual([]);
  });

  it("falls back factorName to factorId and percentile to undefined", () => {
    const [s] = mapSessionRows([
      {
        id: "s",
        assessment_id: "a",
        status: "x",
        participant_scores: [
          {
            factor_id: "f9",
            raw_score: "1",
            scaled_score: "2",
            percentile: null,
            scoring_method: "sum",
            factors: null,
          },
        ],
      },
    ]);
    expect(s.scores[0].factorName).toBe("f9");
    expect(s.scores[0].percentile).toBeUndefined();
  });

  it("returns [] for nullish input", () => {
    // @ts-expect-error exercising the nullish guard
    expect(mapSessionRows(null)).toEqual([]);
    expect(mapSessionRows([])).toEqual([]);
  });
});

describe("buildActivityEvents", () => {
  it("emits participant + session events sorted ascending by timestamp", () => {
    const events = buildActivityEvents(
      {
        invited_at: "2026-01-01T00:00:00Z",
        started_at: "2026-01-02T00:00:00Z",
        completed_at: "2026-01-05T00:00:00Z",
        campaigns: { title: "Q1 Cohort" },
      },
      [
        {
          started_at: "2026-01-03T00:00:00Z",
          completed_at: "2026-01-04T00:00:00Z",
          assessments: { title: "Numerical" },
        },
      ],
    );

    expect(events.map((e) => e.type)).toEqual([
      "invited",
      "started",
      "session_started",
      "session_completed",
      "completed",
    ]);
    expect(events[0].detail).toBe("Q1 Cohort");
    expect(events[2].label).toBe("Started Numerical");
    expect(events[3].label).toBe("Completed Numerical");
  });

  it("omits absent participant milestones and labels unknown assessments", () => {
    const events = buildActivityEvents(
      { started_at: "2026-01-02T00:00:00Z" },
      [{ started_at: "2026-01-03T00:00:00Z", assessments: null }],
    );
    expect(events.map((e) => e.type)).toEqual(["started", "session_started"]);
    expect(events[1].label).toBe("Started assessment");
  });

  it("returns [] when there is no activity at all", () => {
    expect(buildActivityEvents({}, [])).toEqual([]);
  });
});

describe("groupResponses", () => {
  it("groups items under sections, ordered, joined to responses", () => {
    const groups = groupResponses(
      [
        {
          id: "sec-1",
          title: "Section A",
          display_order: 0,
          assessment_section_items: [
            { item_id: "i2", display_order: 1, items: { id: "i2", stem: "Q2" } },
            { item_id: "i1", display_order: 0, items: { id: "i1", stem: "Q1" } },
          ],
        },
      ],
      [{ item_id: "i1", response_value: "4", response_time_ms: 1200 }],
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      sectionId: "sec-1",
      sectionTitle: "Section A",
      displayOrder: 0,
    });
    // ordered by display_order
    expect(groups[0].items.map((i) => i.itemId)).toEqual(["i1", "i2"]);
    // i1 has a response; i2 does not
    expect(groups[0].items[0]).toMatchObject({
      itemId: "i1",
      stem: "Q1",
      responseValue: 4,
      responseTimeMs: 1200,
    });
    expect(groups[0].items[1].responseValue).toBeUndefined();
    expect(groups[0].items[1].responseTimeMs).toBeUndefined();
  });

  it("falls back stem and itemId when items relation is missing", () => {
    const groups = groupResponses(
      [
        {
          id: "sec",
          title: "S",
          display_order: 0,
          assessment_section_items: [{ item_id: "raw-id", display_order: 0 }],
        },
      ],
      [],
    );
    expect(groups[0].items[0].itemId).toBe("raw-id");
    expect(groups[0].items[0].stem).toBe("");
  });

  it("returns [] for nullish sections", () => {
    // @ts-expect-error exercising the nullish guard
    expect(groupResponses(null, null)).toEqual([]);
  });
});
