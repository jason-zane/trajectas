import { describe, expect, it } from "vitest"
import {
  computeDifficultyEstimate,
  analyzeDifficultyDistribution,
  buildDifficultySteering,
} from "@/lib/ai/generation/difficulty-targeting"

describe("computeDifficultyEstimate", () => {
  it("returns 0 for items at the centroid", () => {
    const estimate = computeDifficultyEstimate([1, 0, 0], [1, 0, 0])
    expect(estimate).toBeCloseTo(0)
  })

  it("returns higher values for items further from centroid", () => {
    const close = computeDifficultyEstimate([0.9, 0.1, 0], [1, 0, 0])
    const far = computeDifficultyEstimate([0.3, 0.7, 0], [1, 0, 0])
    expect(far).toBeGreaterThan(close)
  })

  it("returns values between 0 and 1", () => {
    const estimate = computeDifficultyEstimate([0.5, 0.5, 0], [1, 0, 0])
    expect(estimate).toBeGreaterThanOrEqual(0)
    expect(estimate).toBeLessThanOrEqual(1)
  })
})

describe("analyzeDifficultyDistribution", () => {
  it("identifies skew toward easy items", () => {
    const estimates = [0.05, 0.1, 0.08, 0.12, 0.15, 0.07, 0.09, 0.11]
    const result = analyzeDifficultyDistribution(estimates)
    expect(result.skew).toBe("easy")
  })

  it("returns balanced when distribution is even", () => {
    const estimates = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    const result = analyzeDifficultyDistribution(estimates)
    expect(result.skew).toBe("balanced")
  })

  it("returns counts per zone", () => {
    const estimates = [0.1, 0.2, 0.4, 0.5, 0.7, 0.8]
    const result = analyzeDifficultyDistribution(estimates)
    expect(result.easy).toBe(2)
    expect(result.moderate).toBe(2)
    expect(result.hard).toBe(2)
  })
})

describe("buildDifficultySteering", () => {
  it("returns steering text when skewed easy", () => {
    const text = buildDifficultySteering("easy")
    expect(text).toContain("easy-to-endorse")
    expect(text).toContain("trade-off framing")
  })

  it("returns steering text when skewed hard", () => {
    const text = buildDifficultySteering("hard")
    expect(text).toContain("broadly relatable")
  })

  it("returns empty string when balanced", () => {
    expect(buildDifficultySteering("balanced")).toBe("")
  })
})
