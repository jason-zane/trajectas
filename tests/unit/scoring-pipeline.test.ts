import { describe, expect, it } from "vitest";
import {
  aggregateToDimensions,
  aggregateToFactors,
  runScoringPipeline,
  scoreItems,
} from "@/lib/scoring/pipeline";
import type { ScoringItemMeta } from "@/types/scoring";

function createItem(overrides: Partial<ScoringItemMeta>): ScoringItemMeta {
  return {
    id: "item-1",
    constructId: "construct-1",
    responseFormatId: "likert-5",
    reverseScored: false,
    weight: 1,
    maxValue: 5,
    minValue: 1,
    ...overrides,
  };
}

describe("scoring pipeline", () => {
  it("scores items, reverse-scores flagged items, and rolls up the taxonomy", () => {
    const items = new Map<string, ScoringItemMeta>([
      [
        "item-1",
        createItem({ id: "item-1", constructId: "construct-a", weight: 1 }),
      ],
      [
        "item-2",
        createItem({
          id: "item-2",
          constructId: "construct-a",
          reverseScored: true,
          weight: 2,
        }),
      ],
      [
        "item-3",
        createItem({ id: "item-3", constructId: "construct-b", weight: 1 }),
      ],
    ]);

    const scored = scoreItems(
      new Map<string, number>([
        ["item-1", 4],
        ["item-2", 1],
        ["item-3", 3],
        ["missing-item", 5],
      ]),
      items
    );

    expect(scored).toEqual([
      { itemId: "item-1", rawValue: 4, effectiveValue: 4, pompValue: 75 },
      { itemId: "item-2", rawValue: 1, effectiveValue: 5, pompValue: 100 },
      { itemId: "item-3", rawValue: 3, effectiveValue: 3, pompValue: 50 },
    ]);

    const output = runScoringPipeline(new Map(scored.map((item) => [item.itemId, item.rawValue])), {
      sessionId: "session-1",
      assessmentId: "assessment-1",
      scoringMethod: "ctt",
      items,
      factorConstructLinks: [
        { factorId: "factor-1", constructId: "construct-a", weight: 1 },
        { factorId: "factor-1", constructId: "construct-b", weight: 3 },
      ],
      factorDimensionLinks: [{ factorId: "factor-1", dimensionId: "dimension-1" }],
      constructNames: new Map([
        ["construct-a", "Construct A"],
        ["construct-b", "Construct B"],
      ]),
      factorNames: new Map([["factor-1", "Factor 1"]]),
      dimensionNames: new Map([["dimension-1", "Dimension 1"]]),
    });

    expect(output.constructScores).toHaveLength(2);
    expect(output.constructScores[0]).toMatchObject({
      constructId: "construct-a",
      itemCount: 2,
      scores: {
        raw: 14,
        rawMax: 15,
      },
    });
    expect(output.constructScores[0]?.scores.pomp).toBeCloseTo(91.6667, 3);
    expect(output.factorScores[0]).toMatchObject({
      factorId: "factor-1",
      factorName: "Factor 1",
      rawScore: 17,
      itemsUsed: 3,
      scoringMethod: "ctt",
    });
    expect(output.factorScores[0]?.scaledScore).toBeCloseTo(60.4167, 3);
    expect(output.dimensionScores[0]).toMatchObject({
      dimensionId: "dimension-1",
      dimensionName: "Dimension 1",
      scores: { raw: 17 },
    });
    expect(output.dimensionScores[0]?.scores.pomp).toBeCloseTo(60.4167, 3);
    expect(output.scoredAt).toMatch(/T/);
  });

  it("skips empty factor and dimension rollups cleanly", () => {
    const factorScores = aggregateToFactors(
      [],
      [{ factorId: "factor-empty", constructId: "missing", weight: 1 }],
      undefined,
      "hybrid"
    );
    const dimensionScores = aggregateToDimensions(factorScores, [
      { factorId: "factor-empty", dimensionId: "dimension-empty" },
    ]);

    expect(factorScores).toEqual([]);
    expect(dimensionScores).toEqual([]);
  });
});
