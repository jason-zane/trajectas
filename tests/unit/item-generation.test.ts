import { describe, expect, it } from "vitest"
import { buildItemGenerationPrompt } from "@/lib/ai/generation/prompts/item-generation"

describe("buildItemGenerationPrompt facet diversity", () => {
  const baseConstruct = {
    id: "1",
    name: "Resilience",
    slug: "resilience",
    definition: "Ability to recover from setbacks",
    existingItemCount: 0,
  }

  it("includes facet coverage section when previousFacets provided", () => {
    const prompt = buildItemGenerationPrompt({
      construct: baseConstruct,
      batchSize: 20,
      responseFormatDescription: "5-point Likert",
      previousItems: ["I bounce back quickly from setbacks"],
      previousFacets: ["emotional recovery", "persistence", "stress tolerance"],
    })

    expect(prompt).toContain("## Facet Coverage")
    expect(prompt).toContain("Previous batches covered these facets")
    expect(prompt).toContain("emotional recovery")
    expect(prompt).toContain("persistence")
    expect(prompt).toContain("stress tolerance")
  })

  it("omits facet coverage section when no previousFacets", () => {
    const prompt = buildItemGenerationPrompt({
      construct: baseConstruct,
      batchSize: 20,
      responseFormatDescription: "5-point Likert",
      previousItems: [],
    })

    expect(prompt).not.toContain("## Facet Coverage")
  })

  it("omits facet coverage when previousFacets is empty", () => {
    const prompt = buildItemGenerationPrompt({
      construct: baseConstruct,
      batchSize: 20,
      responseFormatDescription: "5-point Likert",
      previousItems: ["I bounce back"],
      previousFacets: [],
    })

    expect(prompt).not.toContain("## Facet Coverage")
  })
})
