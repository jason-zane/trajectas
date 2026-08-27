/**
 * deriveChanges — the guard against manufacturing a trend.
 *
 * The rule: change is only ever claimed for the SAME factor measured by the
 * SAME assessment. A factor name that appears under two instruments is not one
 * measurement observed twice, and differencing them would produce a number that
 * looks like progress and means nothing.
 */

import { describe, expect, it } from "vitest";
import { deriveChanges } from "@/lib/dal/chat-timeline";

function sitting(
  over: Partial<Parameters<typeof deriveChanges>[0][number]> = {},
): Parameters<typeof deriveChanges>[0][number] {
  return {
    sessionId: "s1",
    campaignParticipantId: "cp1",
    campaignId: "c1",
    campaignTitle: "Campaign",
    assessmentId: "a1",
    assessmentTitle: "Instrument A",
    completedAt: "2026-01-01T00:00:00.000Z",
    factors: [],
    compositeScore: null,
    compositeMethod: null,
    href: null,
    ...over,
  };
}

const factor = (factorId: string, name: string, scaledScore: number) => ({
  factorId,
  name,
  scaledScore,
  provisional: false,
});

describe("deriveChanges", () => {
  it("reports change for the same factor on the same assessment", () => {
    const changes = deriveChanges([
      sitting({ sessionId: "s1", factors: [factor("f1", "Judgement", 50)] }),
      sitting({
        sessionId: "s2",
        completedAt: "2026-06-01T00:00:00.000Z",
        factors: [factor("f1", "Judgement", 62)],
      }),
    ]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      factorName: "Judgement",
      fromScore: 50,
      toScore: 62,
      delta: 12,
    });
  });

  it("refuses to difference the same factor across different assessments", () => {
    const changes = deriveChanges([
      sitting({ sessionId: "s1", assessmentId: "a1", factors: [factor("f1", "Judgement", 50)] }),
      sitting({
        sessionId: "s2",
        assessmentId: "a2",
        assessmentTitle: "Instrument B",
        factors: [factor("f1", "Judgement", 90)],
      }),
    ]);
    // Two sittings, same factor id, different instruments — no claim.
    expect(changes).toEqual([]);
  });

  it("says nothing from a single sitting", () => {
    expect(
      deriveChanges([sitting({ factors: [factor("f1", "Judgement", 50)] })]),
    ).toEqual([]);
  });

  it("uses first and latest, not consecutive pairs", () => {
    const changes = deriveChanges([
      sitting({ sessionId: "s1", factors: [factor("f1", "Judgement", 40)] }),
      sitting({ sessionId: "s2", factors: [factor("f1", "Judgement", 90)] }),
      sitting({ sessionId: "s3", factors: [factor("f1", "Judgement", 55)] }),
    ]);
    expect(changes[0]).toMatchObject({ fromScore: 40, toScore: 55, delta: 15 });
  });

  it("ranks by magnitude of movement regardless of direction", () => {
    const changes = deriveChanges([
      sitting({
        sessionId: "s1",
        factors: [factor("f1", "Small", 50), factor("f2", "Big", 50)],
      }),
      sitting({
        sessionId: "s2",
        factors: [factor("f1", "Small", 52), factor("f2", "Big", 20)],
      }),
    ]);
    expect(changes[0].factorName).toBe("Big");
    expect(changes[0].delta).toBe(-30);
  });

  it("ignores sittings with no assessment to anchor the comparison", () => {
    const changes = deriveChanges([
      sitting({ sessionId: "s1", assessmentId: null, factors: [factor("f1", "X", 10)] }),
      sitting({ sessionId: "s2", assessmentId: null, factors: [factor("f1", "X", 90)] }),
    ]);
    expect(changes).toEqual([]);
  });

  it("rounds the delta rather than emitting float noise", () => {
    const changes = deriveChanges([
      sitting({ sessionId: "s1", factors: [factor("f1", "X", 50.1)] }),
      sitting({ sessionId: "s2", factors: [factor("f1", "X", 62.4)] }),
    ]);
    expect(changes[0].delta).toBe(12.3);
  });
});
