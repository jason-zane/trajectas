import { describe, expect, it } from "vitest"
import { buildCritiquePrompt, parseCritiqueResponse } from "@/lib/ai/generation/prompts/item-critique"

describe("buildCritiquePrompt", () => {
  it("includes all items and construct context", () => {
    const prompt = buildCritiquePrompt({
      items: [
        { stem: "I bounce back quickly", reverseScored: false, rationale: "resilience" },
        { stem: "I give up easily", reverseScored: true, rationale: "lack of resilience" },
      ],
      constructName: "Resilience",
      constructDefinition: "Ability to recover from setbacks",
      contrastConstructs: [
        { name: "Adaptability", definition: "Adjusting to change" },
      ],
    })

    expect(prompt).toContain("I bounce back quickly")
    expect(prompt).toContain("I give up easily")
    expect(prompt).toContain("Resilience")
    expect(prompt).toContain("Ability to recover from setbacks")
    expect(prompt).toContain("Adaptability")
  })
})

describe("parseCritiqueResponse", () => {
  it("parses valid keep/revise/drop verdicts", () => {
    const result = parseCritiqueResponse(JSON.stringify([
      { originalStem: "item 1", verdict: "keep" },
      { originalStem: "item 2", verdict: "revise", revisedStem: "item 2 revised", reason: "too vague" },
      { originalStem: "item 3", verdict: "drop", reason: "cross-loads" },
    ]))

    expect(result).toHaveLength(3)
    expect(result![0]).toEqual({ originalStem: "item 1", verdict: "keep" })
    expect(result![1]).toEqual({ originalStem: "item 2", verdict: "revise", revisedStem: "item 2 revised", reason: "too vague" })
    expect(result![2]).toEqual({ originalStem: "item 3", verdict: "drop", reason: "cross-loads" })
  })

  it("returns null for unparseable response", () => {
    expect(parseCritiqueResponse("not json")).toBeNull()
  })

  it("handles markdown-wrapped JSON", () => {
    const result = parseCritiqueResponse('```json\n[{"originalStem":"x","verdict":"keep"}]\n```')
    expect(result).toHaveLength(1)
    expect(result![0].verdict).toBe("keep")
  })

  it("filters invalid verdicts", () => {
    const result = parseCritiqueResponse(JSON.stringify([
      { originalStem: "item 1", verdict: "keep" },
      { originalStem: "item 2", verdict: "invalid" },
      { verdict: "keep" },
    ]))

    expect(result).toHaveLength(1)
    expect(result![0].originalStem).toBe("item 1")
  })
})
