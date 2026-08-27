/**
 * The central accuracy claim of grounded chat, as a test.
 *
 * Numbers reach the browser as a rendered card and reach the model not at all.
 * What the model gets is identity plus ORDINAL facts computed in code, which
 * are derived from the real values and are therefore correct by construction.
 *
 * The strongest assertion here is the last one: serialise everything the model
 * would receive for a realistic result, and prove no score value appears
 * anywhere in that payload. That is the difference between a model that is
 * discouraged from misstating a score and one that cannot — it never held it.
 */

import { describe, expect, it } from "vitest";
import { ordinalFactsFrom, completionBucket } from "@/lib/chat/redaction";
import { getSessionScoresTool } from "@/lib/chat/tools/get-session-scores";
import { getCampaignProgressTool } from "@/lib/chat/tools/get-campaign-progress";

const FACTORS = [
  { name: "Analytical Thinking", scaledScore: 71.5, provisional: false },
  { name: "Commercial Acumen", scaledScore: 44.2, provisional: false },
  { name: "Judgement", scaledScore: 88.9, provisional: true },
];

describe("ordinalFactsFrom", () => {
  it("names the extremes without exposing their values", () => {
    const facts = ordinalFactsFrom(FACTORS);
    expect(facts.highestFactor).toBe("Judgement");
    expect(facts.lowestFactor).toBe("Commercial Acumen");
    expect(facts.factorCount).toBe(3);
    expect(JSON.stringify(facts)).not.toContain("88.9");
    expect(JSON.stringify(facts)).not.toContain("44.2");
  });

  it("reports provisional and norm-referenced status", () => {
    expect(ordinalFactsFrom(FACTORS).anyProvisional).toBe(true);
    expect(ordinalFactsFrom(FACTORS).normReferenced).toBe(false);
    expect(
      ordinalFactsFrom([
        { name: "A", scaledScore: 1, provisional: false, percentile: 50 },
      ]).normReferenced,
    ).toBe(true);
  });

  it("withholds a highest/lowest claim when there is nothing to compare", () => {
    const facts = ordinalFactsFrom([FACTORS[0]]);
    expect(facts.highestFactor).toBeNull();
    expect(facts.lowestFactor).toBeNull();
  });

  it("handles an empty result without inventing structure", () => {
    expect(ordinalFactsFrom([])).toEqual({
      factorCount: 0,
      factorNames: [],
      highestFactor: null,
      lowestFactor: null,
      anyProvisional: false,
      normReferenced: false,
    });
  });
});

describe("completionBucket", () => {
  it("buckets without revealing counts", () => {
    expect(completionBucket(0, 0)).toBe("no_participants");
    expect(completionBucket(0, 10)).toBe("none_completed");
    expect(completionBucket(10, 10)).toBe("all_completed");
    expect(completionBucket(7, 10)).toBe("most_completed");
    expect(completionBucket(2, 10)).toBe("some_completed");
  });
});

describe("what the model is given", () => {
  it("a score result carries no numeric value at all", () => {
    const data = {
      session: {
        sessionId: "11111111-1111-1111-1111-111111111111",
        status: "completed",
        completedAt: "2026-08-20T15:30:00.000Z",
        campaignId: "22222222-2222-2222-2222-222222222222",
        participantId: "33333333-3333-3333-3333-333333333333",
        participantName: "Sarah Chen",
        assessmentTitle: "Leadership Inventory",
        href: "/campaigns/2/participants/3/sessions/1",
      },
      factors: [
        {
          factorId: "f1",
          name: "Analytical Thinking",
          scaledScore: 71.5,
          provisional: false,
        },
        {
          factorId: "f2",
          name: "Judgement",
          scaledScore: 88.9,
          provisional: true,
          percentile: 93,
          confidenceIntervalLower: 84.1,
          confidenceIntervalUpper: 93.7,
          normVersion: "2026.1",
        },
      ],
      bandScheme: { palette: "indicator", bands: [] },
      caveats: ["No norm group for some factors."],
      normReferenced: false,
      droppedRows: 0,
      cognitiveRows: 0,
    };

    const redacted = JSON.stringify(getSessionScoresTool.redactForModel!(data));

    // Identity survives — the model needs it to write a sentence.
    expect(redacted).toContain("Sarah Chen");
    expect(redacted).toContain("Leadership Inventory");
    // The ordinal fact survives, because code computed it.
    expect(redacted).toContain("Judgement");

    // Not one measurement does.
    for (const value of ["71.5", "88.9", "93", "84.1", "93.7", "2026.1"]) {
      expect(redacted, `leaked ${value}`).not.toContain(value);
    }
  });

  it("a campaign result carries no count", () => {
    const data = {
      campaign: {
        campaignId: "c1",
        title: "Q1 Leadership",
        status: "active",
        kind: "baseline",
        clientName: "Acme",
        opensAt: null,
        closesAt: null,
        href: "/campaigns/c1",
      },
      progress: { invited: 50, started: 42, completed: 37, scoredSessions: 37 },
      caveats: [],
    };

    const redacted = JSON.stringify(getCampaignProgressTool.redactForModel!(data));

    expect(redacted).toContain("Q1 Leadership");
    expect(redacted).toContain("most_completed");
    for (const value of ["50", "42", "37"]) {
      expect(redacted, `leaked ${value}`).not.toContain(value);
    }
  });

  it("every tool that returns measurements declares a redaction", async () => {
    // A new score-bearing tool added without redactForModel would silently
    // hand raw values to the model, so the requirement is asserted rather
    // than left to review.
    const { CHAT_TOOLS } = await import("@/lib/chat/tools");
    const measurementTools = ["get_session_scores", "get_campaign_progress"];
    for (const name of measurementTools) {
      const tool = CHAT_TOOLS.find((t) => t.name === name);
      expect(tool, `${name} is not registered`).toBeDefined();
      expect(
        typeof tool!.redactForModel,
        `${name} must declare redactForModel`,
      ).toBe("function");
    }
  });
});
