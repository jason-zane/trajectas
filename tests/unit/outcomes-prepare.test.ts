import { describe, it, expect } from "vitest";
import {
  prepareOutcomeInput,
  predictorFor,
  type SourcePerson,
  type SourceSession,
  type SourceScore,
} from "@/lib/outcomes/prepare";
import { EMPTY_OUTCOME_CONFIG, type OutcomeConfig } from "@/lib/outcomes/types";
import {
  strictNumber,
  csvCell,
  outcomeConfigSchema,
} from "@/lib/outcomes/validation";
function fixture() {
  const people: SourcePerson[] = [
    {
      id: "participant-a",
      person_key: "person-a",
      email: "a@example.test",
      campaign_id: "campaign",
    },
  ];
  const sessions: SourceSession[] = [
    {
      id: "session-a",
      campaign_id: "campaign",
      campaign_participant_id: "participant-a",
      assessment_id: "assessment",
      completed_at: "2025-12-01T00:00:00Z",
      assessments: { title: "Assessment" },
    },
  ];
  const scores: SourceScore[] = [
    {
      session_id: "session-a",
      factor_id: "factor-a",
      scaled_score: 3,
      scoring_method: "classical",
      metric: "overall",
      scoring_variant: null,
      parameter_scale_code: null,
      norm_group_id: null,
      norm_version: null,
      factors: { name: "Capability" },
    },
  ];
  const config: OutcomeConfig = {
    ...EMPTY_OUTCOME_CONFIG,
    periodStart: "2026-01-01",
    periodEnd: "2026-03-31",
    comparabilityReviewed: true,
    joinColumn: "person_key",
    campaignIds: ["campaign"],
    predictorIds: [predictorFor(scores[0], sessions[0]).id],
    metrics: [
      {
        id: "csat",
        column: "csat",
        label: "Customer satisfaction",
        kind: "continuous",
        display: "number",
        direction: "higher",
        unit: "points",
        currency: "AUD",
        minimum: 0,
        maximum: 100,
        exposureColumn: "",
      },
    ],
  };
  return {
    config,
    people,
    sessions,
    scores,
    headers: ["person_key", "csat"],
    records: [["person-a", "80"]],
    source: {
      checksum: "source-hash",
      filename: "business.csv",
      extractedAt: "2026-04-01",
      formVersions: [],
    },
  };
}
describe("business outcomes input preparation", () => {
  it("matches exact client-scoped identities and freezes a de-identified row", () => {
    const f = fixture(),
      input = prepareOutcomeInput(f);
    expect(input.quality).toMatchObject({
      imported: 1,
      matched: 1,
      eligible: 1,
    });
    expect(input.rows[0].outcomes.csat).toBe(80);
    expect(input.rows[0].id).not.toContain("person-a");
    expect(JSON.stringify(input.rows)).not.toContain("a@example.test");
  });
  it("chooses the most recent pre-period score and ignores later scores", () => {
    const f = fixture();
    f.sessions.push(
      { ...f.sessions[0], id: "older", completed_at: "2025-10-01T00:00:00Z" },
      { ...f.sessions[0], id: "later", completed_at: "2026-02-01T00:00:00Z" },
    );
    f.scores.push(
      { ...f.scores[0], session_id: "older", scaled_score: 1 },
      { ...f.scores[0], session_id: "later", scaled_score: 5 },
    );
    expect(Object.values(prepareOutcomeInput(f).rows[0].scores)).toEqual([3]);
  });
  it("refuses a dataset made entirely of duplicate person rows", () => {
    const f = fixture();
    f.records.push(["person-a", "95"]);
    expect(() => prepareOutcomeInput(f)).toThrow("No eligible people remain");
  });
  it("counts duplicate rows instead of weighting one person twice", () => {
    const f = fixture();
    f.people.push({
      ...f.people[0],
      id: "participant-b",
      person_key: "person-b",
      email: "b@example.test",
    });
    f.sessions.push({
      ...f.sessions[0],
      id: "session-b",
      campaign_participant_id: "participant-b",
    });
    f.scores.push({ ...f.scores[0], session_id: "session-b" });
    f.records.push(["person-b", "65"], ["person-b", "70"]);
    const input = prepareOutcomeInput(f);
    expect(input.rows).toHaveLength(1);
    expect(
      input.quality.excluded["Duplicate business rows for one person"],
    ).toBe(2);
  });
  it("keeps scoring and norm versions distinct even with the same factor name", () => {
    const f = fixture();
    expect(
      predictorFor({ ...f.scores[0], norm_version: "v2" }, f.sessions[0]).id,
    ).not.toBe(f.config.predictorIds[0]);
  });
  it("rejects data outside declared scales and non-numeric nonblank cells", () => {
    const f = fixture();
    f.records[0][1] = "101";
    expect(() => prepareOutcomeInput(f)).toThrow("outside");
    f.records[0][1] = "80%";
    expect(() => prepareOutcomeInput(f)).toThrow("without currency symbols");
  });
  it("keeps missing values distinct from zero", () => {
    expect(strictNumber("")).toBeNull();
    expect(strictNumber("0")).toBe(0);
    expect(strictNumber("1,000")).toBeNull();
    expect(strictNumber("NaN")).toBeNull();
  });
  it("escapes spreadsheet formulas without turning genuine negative estimates into text", () => {
    expect(csvCell('=HYPERLINK("bad")')).toBe('"\'=HYPERLINK(""bad"")"');
    expect(csvCell(-1.23)).toBe("-1.23");
  });
  it("requires valid outcome periods", () => {
    expect(
      outcomeConfigSchema.safeParse({
        ...EMPTY_OUTCOME_CONFIG,
        periodStart: "2026-04-01",
        periodEnd: "2026-01-01",
      }).success,
    ).toBe(false);
  });
  it("does not use a post-outcome control mapped from the outcome itself", () => {
    const f = fixture();
    f.config.controls = [{ column: "csat", kind: "numeric" }];
    expect(() => prepareOutcomeInput(f)).toThrow("distinct");
  });
});
