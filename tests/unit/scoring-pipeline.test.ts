import { describe, expect, it } from "vitest";
import {
  aggregateConstructsToDimensions,
  aggregateToConstructs,
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

  it("aggregateToDimensions groups multiple factors under the same dimension", () => {
    const items = new Map<string, ScoringItemMeta>([
      ["item-1", createItem({ id: "item-1", constructId: "c-1" })],
      ["item-2", createItem({ id: "item-2", constructId: "c-2" })],
    ]);
    const scored = scoreItems(
      new Map<string, number>([
        ["item-1", 5],
        ["item-2", 1],
      ]),
      items
    );
    const constructs = aggregateToConstructs(scored, items);
    const factors = aggregateToFactors(
      constructs,
      [
        { factorId: "f-a", constructId: "c-1", weight: 1 },
        { factorId: "f-b", constructId: "c-2", weight: 1 },
      ],
      new Map([
        ["f-a", "Factor A"],
        ["f-b", "Factor B"],
      ]),
      "ctt"
    );

    // Both factors map to the same dimension — exercises the
    // existing.push branch in aggregateToDimensions.
    const dimensions = aggregateToDimensions(
      factors,
      [
        { factorId: "f-a", dimensionId: "d-1" },
        { factorId: "f-b", dimensionId: "d-1" },
      ],
      new Map([["d-1", "Dim 1"]])
    );

    expect(dimensions).toHaveLength(1);
    expect(dimensions[0]?.factorScores).toHaveLength(2);
    // Mean of factor POMP scores
    expect(dimensions[0]?.scores.pomp).toBeCloseTo(50, 0);
  });

  describe("aggregateConstructsToDimensions (construct-level scoring)", () => {
    it("rolls up constructs directly to dimensions with weighted POMP average", () => {
      const items = new Map<string, ScoringItemMeta>([
        ["item-1", createItem({ id: "item-1", constructId: "c-1", maxValue: 5, minValue: 1 })],
        ["item-2", createItem({ id: "item-2", constructId: "c-2", maxValue: 5, minValue: 1 })],
      ]);
      const scored = scoreItems(
        new Map<string, number>([
          ["item-1", 5], // POMP 100
          ["item-2", 1], // POMP 0
        ]),
        items
      );
      const constructs = aggregateToConstructs(scored, items);

      const dims = aggregateConstructsToDimensions(
        constructs,
        [
          { dimensionId: "d-1", constructId: "c-1", weight: 3 },
          { dimensionId: "d-1", constructId: "c-2", weight: 1 },
        ],
        new Map([["d-1", "Dimension 1"]])
      );

      expect(dims).toHaveLength(1);
      // Weighted: (100*3 + 0*1) / 4 = 75
      expect(dims[0]?.scores.pomp).toBeCloseTo(75, 3);
      expect(dims[0]?.dimensionName).toBe("Dimension 1");
      expect(dims[0]?.constructScores).toHaveLength(2);
    });

    it("groups multiple constructs under one dimension via the existing.push branch", () => {
      const items = new Map<string, ScoringItemMeta>([
        ["item-1", createItem({ id: "item-1", constructId: "c-a" })],
      ]);
      const scored = scoreItems(new Map([["item-1", 3]]), items);
      const constructs = aggregateToConstructs(scored, items);

      const dims = aggregateConstructsToDimensions(constructs, [
        { dimensionId: "d-1", constructId: "c-a", weight: 1 },
        { dimensionId: "d-1", constructId: "c-missing", weight: 2 },
      ]);

      expect(dims).toHaveLength(1);
      // The missing construct is skipped; only c-a contributes.
      expect(dims[0]?.constructScores).toHaveLength(1);
    });

    it("skips dimensions where total weight is zero", () => {
      const dims = aggregateConstructsToDimensions(
        [],
        [{ dimensionId: "d-1", constructId: "c-missing", weight: 1 }]
      );
      expect(dims).toEqual([]);
    });
  });

  it("runScoringPipeline routes to construct-level when scoringLevel is 'construct'", () => {
    const items = new Map<string, ScoringItemMeta>([
      ["item-1", createItem({ id: "item-1", constructId: "c-1" })],
    ]);

    const output = runScoringPipeline(new Map([["item-1", 4]]), {
      sessionId: "s-1",
      assessmentId: "a-1",
      scoringMethod: "ctt",
      scoringLevel: "construct",
      items,
      factorConstructLinks: [],
      factorDimensionLinks: [],
      dimensionConstructLinks: [
        { dimensionId: "d-1", constructId: "c-1", weight: 1 },
      ],
      constructNames: new Map([["c-1", "Construct 1"]]),
      dimensionNames: new Map([["d-1", "Dimension 1"]]),
    });

    expect(output.factorScores).toEqual([]);
    expect(output.dimensionScores).toHaveLength(1);
    expect(output.dimensionScores[0]?.dimensionId).toBe("d-1");
    // POMP for value 4 on a 1-5 Likert is 75
    expect(output.dimensionScores[0]?.scores.pomp).toBeCloseTo(75, 3);
  });
});
