import { describe, expect, it } from "vitest"

import {
  PREFLIGHT_REVIEW_SIMILARITY_THRESHOLD,
  selectPairsForLlmReview,
} from "@/lib/ai/generation/construct-preflight"

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
