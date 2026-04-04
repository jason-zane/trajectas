import { describe, expect, it } from "vitest"
import {
  generatePersonas,
  parseSyntheticResponses,
  computeCronbachAlpha,
  computeItemTotalCorrelations,
} from "@/lib/ai/generation/synthetic-validation"

describe("generatePersonas", () => {
  it("generates the requested number of personas", () => {
    const personas = generatePersonas(
      [{ id: "c1", name: "Resilience" }, { id: "c2", name: "Adaptability" }],
      10,
    )
    expect(personas).toHaveLength(10)
  })

  it("each persona has trait levels for all constructs", () => {
    const personas = generatePersonas(
      [{ id: "c1", name: "Resilience" }, { id: "c2", name: "Adaptability" }],
      5,
    )
    for (const persona of personas) {
      expect(persona.traitLevels).toHaveProperty("c1")
      expect(persona.traitLevels).toHaveProperty("c2")
      expect(["low", "moderate", "high"]).toContain(persona.traitLevels.c1)
    }
  })
})

describe("parseSyntheticResponses", () => {
  it("parses valid response array", () => {
    const result = parseSyntheticResponses(JSON.stringify([
      { itemIndex: 0, rating: 4 },
      { itemIndex: 1, rating: 2 },
    ]))
    expect(result).toHaveLength(2)
    expect(result![0]).toEqual({ itemIndex: 0, rating: 4 })
  })

  it("returns null for invalid JSON", () => {
    expect(parseSyntheticResponses("not json")).toBeNull()
  })

  it("filters ratings outside 1-5 range", () => {
    const result = parseSyntheticResponses(JSON.stringify([
      { itemIndex: 0, rating: 4 },
      { itemIndex: 1, rating: 7 },
      { itemIndex: 2, rating: 0 },
    ]))
    expect(result).toHaveLength(1)
  })
})

describe("computeCronbachAlpha", () => {
  it("returns high alpha for consistent responses", () => {
    const matrix = [
      [5, 5, 5],
      [4, 4, 4],
      [3, 3, 3],
      [2, 2, 2],
      [1, 1, 1],
    ]
    const alpha = computeCronbachAlpha(matrix)
    expect(alpha).toBeGreaterThan(0.9)
  })

  it("returns low alpha for random responses", () => {
    const matrix = [
      [5, 1, 3],
      [1, 5, 2],
      [3, 2, 5],
      [2, 4, 1],
      [4, 3, 4],
    ]
    const alpha = computeCronbachAlpha(matrix)
    expect(alpha).toBeLessThan(0.5)
  })

  it("returns 0 for single item", () => {
    const matrix = [[5], [4], [3]]
    expect(computeCronbachAlpha(matrix)).toBe(0)
  })
})

describe("computeItemTotalCorrelations", () => {
  it("returns correlation for each item", () => {
    const matrix = [
      [5, 5, 1],
      [4, 4, 2],
      [3, 3, 3],
      [2, 2, 4],
      [1, 1, 5],
    ]
    const correlations = computeItemTotalCorrelations(matrix)
    expect(correlations).toHaveLength(3)
    expect(correlations[0]).toBeGreaterThan(0.5)
    expect(correlations[2]).toBeLessThan(0)
  })
})
