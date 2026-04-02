import { describe, expect, it } from "vitest"

import {
  PREFLIGHT_REVIEW_SIMILARITY_THRESHOLD,
  selectPairsForLlmReview,
} from "@/lib/ai/generation/construct-preflight"
import { buildDiscriminationPrompt } from "@/lib/ai/generation/prompts/construct-discrimination"
import { buildRefinementPrompt } from "@/lib/ai/generation/prompts/construct-refinement"

describe("construct preflight sensitivity", () => {
  it("reviews near-overlap pairs above the lower review threshold", () => {
    const reviewed = selectPairsForLlmReview(
      [
        { constructAIndex: 0, constructBIndex: 1, cosineSimilarity: PREFLIGHT_REVIEW_SIMILARITY_THRESHOLD + 0.02 },
        { constructAIndex: 0, constructBIndex: 2, cosineSimilarity: 0.41 },
      ],
      PREFLIGHT_REVIEW_SIMILARITY_THRESHOLD,
      0,
    )

    expect(reviewed.has("0:1")).toBe(true)
    expect(reviewed.has("0:2")).toBe(false)
  })

  it("always reviews the top-ranked pairs even when they sit below the threshold", () => {
    const reviewed = selectPairsForLlmReview(
      [
        { constructAIndex: 0, constructBIndex: 1, cosineSimilarity: 0.49 },
        { constructAIndex: 0, constructBIndex: 2, cosineSimilarity: 0.46 },
        { constructAIndex: 1, constructBIndex: 2, cosineSimilarity: 0.45 },
      ],
      0.6,
      2,
    )

    expect(reviewed.has("0:1")).toBe(true)
    expect(reviewed.has("0:2")).toBe(true)
    expect(reviewed.has("1:2")).toBe(false)
  })
})

describe("buildDiscriminationPrompt context", () => {
  const constructA = { name: "Resilience", definition: "Ability to recover from setbacks" }
  const constructB = { name: "Adaptability", definition: "Ability to adjust to new conditions" }

  it("includes construct landscape when otherConstructs provided", () => {
    const prompt = buildDiscriminationPrompt(constructA, constructB, {
      otherConstructs: [
        { name: "Empathy", definition: "Understanding others' emotions" },
        { name: "Initiative", definition: "Taking action without being asked" },
      ],
    })

    expect(prompt).toContain("## Construct Landscape")
    expect(prompt).toContain("**Empathy**")
    expect(prompt).toContain("**Initiative**")
    // Should NOT include the pair being evaluated in the landscape
    expect(prompt).not.toContain("**Resilience**")
    expect(prompt).not.toContain("**Adaptability**")
  })

  it("omits landscape section when no otherConstructs provided", () => {
    const prompt = buildDiscriminationPrompt(constructA, constructB)
    expect(prompt).not.toContain("## Construct Landscape")
  })

  it("includes changes section when changes provided", () => {
    const prompt = buildDiscriminationPrompt(constructA, constructB, {
      changes: [
        {
          constructId: "1",
          constructName: "Resilience",
          field: "definition",
          previousValue: "Old definition",
          currentValue: "Ability to recover from setbacks",
        },
      ],
    })

    expect(prompt).toContain("## Changes Since Last Check")
    expect(prompt).toContain("**Resilience**")
    expect(prompt).toContain("Old definition")
  })

  it("omits changes section when no changes provided", () => {
    const prompt = buildDiscriminationPrompt(constructA, constructB, {
      otherConstructs: [{ name: "Empathy", definition: "Understanding others' emotions" }],
    })

    expect(prompt).not.toContain("## Changes Since Last Check")
  })
})

describe("buildRefinementPrompt context", () => {
  const baseParams = {
    constructName: "Resilience",
    currentDraft: {
      definition: "Ability to recover from setbacks",
      description: "Bouncing back",
      indicatorsLow: "Gives up easily",
      indicatorsMid: "Recovers with support",
      indicatorsHigh: "Thrives under pressure",
    },
    overlappingPairs: [
      {
        otherConstructName: "Adaptability",
        cosineSimilarity: 0.72,
        overlapSummary: "Both relate to coping with change",
      },
    ],
    parentFactors: [],
  }

  it("includes other constructs section excluding target and overlapping", () => {
    const prompt = buildRefinementPrompt({
      ...baseParams,
      allConstructs: [
        { name: "Resilience", definition: "Ability to recover" },
        { name: "Adaptability", definition: "Adjust to change" },
        { name: "Empathy", definition: "Understanding others" },
        { name: "Initiative", definition: "Taking action" },
      ],
    })

    expect(prompt).toContain("## Other Constructs in Set")
    expect(prompt).toContain("**Empathy**")
    expect(prompt).toContain("**Initiative**")
    // Target and overlapping constructs should be excluded from landscape
    expect(prompt).not.toMatch(/## Other Constructs in Set[\s\S]*\*\*Resilience\*\*/)
    expect(prompt).not.toMatch(/## Other Constructs in Set[\s\S]*\*\*Adaptability\*\*/)
  })

  it("includes conservatism instruction", () => {
    const prompt = buildRefinementPrompt(baseParams)
    expect(prompt).toContain("surgical precision")
    expect(prompt).toContain("smallest edit")
  })

  it("includes changes section when provided", () => {
    const prompt = buildRefinementPrompt({
      ...baseParams,
      changes: [
        {
          constructId: "2",
          constructName: "Adaptability",
          field: "definition",
          previousValue: "Old def",
          currentValue: "Adjust to change",
        },
      ],
    })

    expect(prompt).toContain("## Changes Since Last Check")
    expect(prompt).toContain("**Adaptability**")
  })
})
