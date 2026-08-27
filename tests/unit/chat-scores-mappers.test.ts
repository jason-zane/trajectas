/**
 * Unit tests for the chat score mappers.
 *
 * The assertion that matters: toFactorScore builds from the RESOLVED
 * CompetencyScoreDisplay, so the uncalibrated branch — which has no percentile
 * field at all — cannot produce one. A rank claim has nowhere to come from.
 */

import { describe, expect, it } from "vitest";
import {
  toFactorScore,
  toSessionIdentity,
  participantNameFrom,
  type RawScoreRow,
} from "@/lib/dal/chat-scores-mappers";
import { resolveCompetencyScoreDisplay } from "@/lib/reports/competency-claims";

function rawRow(overrides: Partial<RawScoreRow> = {}): RawScoreRow {
  return {
    factor_id: "f1",
    metric: "pomp",
    scaled_score: 62.4,
    raw_score: 31,
    percentile: null,
    confidence_interval_lower: null,
    confidence_interval_upper: null,
    norm_group_id: null,
    norm_version: null,
    provisional: false,
    scoring_variant: null,
    factors: { id: "f1", name: "Judgement" },
    ...overrides,
  };
}

describe("toFactorScore", () => {
  it("omits rank fields for an uncalibrated score", () => {
    const row = rawRow();
    const dto = toFactorScore(row, resolveCompetencyScoreDisplay(row));
    expect(dto).toEqual({
      factorId: "f1",
      name: "Judgement",
      scaledScore: 62.4,
      provisional: false,
    });
    expect("percentile" in dto).toBe(false);
    expect("normVersion" in dto).toBe(false);
  });

  it("cannot leak a stray percentile sitting on an uncalibrated row", () => {
    // The resolver drops it; the mapper has no path to reintroduce it.
    const row = rawRow({ percentile: 91, confidence_interval_lower: 80 });
    const dto = toFactorScore(row, resolveCompetencyScoreDisplay(row));
    expect("percentile" in dto).toBe(false);
    expect(JSON.stringify(dto)).not.toContain("91");
  });

  it("carries rank fields through for a calibrated score", () => {
    const row = rawRow({
      norm_group_id: "11111111-1111-1111-1111-111111111111",
      norm_version: "2026.1",
      percentile: 74,
      confidence_interval_lower: 58,
      confidence_interval_upper: 67,
    });
    const dto = toFactorScore(row, resolveCompetencyScoreDisplay(row));
    expect(dto.percentile).toBe(74);
    expect(dto.normVersion).toBe("2026.1");
  });

  it("names an unnamed factor rather than rendering blank", () => {
    const row = rawRow({ factors: null });
    expect(toFactorScore(row, resolveCompetencyScoreDisplay(row)).name).toBe(
      "Unnamed factor",
    );
  });
});

describe("toSessionIdentity", () => {
  const base = {
    id: "s1",
    status: "completed",
    completed_at: "2026-08-20T15:30:00.000Z",
    campaign_id: "c1",
    assessments: { id: "a1", title: "Leadership Inventory" },
    campaign_participants: {
      id: "p1",
      first_name: "Sarah",
      last_name: "Chen",
      email: "sarah@example.com",
    },
  };

  it("builds the participant-scoped deep link", () => {
    expect(toSessionIdentity(base).href).toBe(
      "/campaigns/c1/participants/p1/sessions/s1",
    );
  });

  it("falls back to the campaign-scoped link with no participant row", () => {
    expect(
      toSessionIdentity({ ...base, campaign_participants: null }).href,
    ).toBe("/campaigns/c1/sessions/s1");
  });

  it("yields no link when there is no campaign to link into", () => {
    expect(toSessionIdentity({ ...base, campaign_id: null }).href).toBeNull();
  });

  it("degrades the participant name gracefully", () => {
    expect(participantNameFrom(null)).toBe("Unknown participant");
    expect(
      participantNameFrom({
        id: "p",
        first_name: null,
        last_name: null,
        email: "x@y.z",
      }),
    ).toBe("x@y.z");
  });
});
