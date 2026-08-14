/**
 * Unit tests for the congruence-panel module.
 *
 * Tests prompt building (stem and candidate inclusion, blind design verification),
 * response parsing (JSON shapes, malformed entries, coercion, forgiving error handling),
 * and rating construction (rater mapping, dropping unassignable raters).
 */

import { describe, it, expect } from "vitest"
import {
  DEFAULT_CONGRUENCE_SYSTEM_PROMPT,
  buildCongruencePrompt,
  parseCongruenceResponse,
  toCongruenceRatings,
  type CongruencePromptInput,
} from "@/lib/instrument/congruence-panel"

// ============================================================================
// System Prompt Tests
// ============================================================================

describe("DEFAULT_CONGRUENCE_SYSTEM_PROMPT", () => {
  it("exists and is a non-empty string", () => {
    expect(typeof DEFAULT_CONGRUENCE_SYSTEM_PROMPT).toBe("string")
    expect(DEFAULT_CONGRUENCE_SYSTEM_PROMPT.length).toBeGreaterThan(0)
  })

  it("references the core task of assigning to exactly one construct", () => {
    expect(DEFAULT_CONGRUENCE_SYSTEM_PROMPT).toMatch(/exactly one construct/i)
  })

  it("explains that raters are blind to the intended construct", () => {
    expect(DEFAULT_CONGRUENCE_SYSTEM_PROMPT).toMatch(/not told.*construct.*written for/i)
  })

  it("defines the 1-4 relevance scale", () => {
    expect(DEFAULT_CONGRUENCE_SYSTEM_PROMPT).toMatch(/1.*4.*scale/i)
    expect(DEFAULT_CONGRUENCE_SYSTEM_PROMPT).toMatch(/1.*not relevant/i)
    expect(DEFAULT_CONGRUENCE_SYSTEM_PROMPT).toMatch(/4.*highly relevant/i)
  })

  it("instructs response format as JSON", () => {
    expect(DEFAULT_CONGRUENCE_SYSTEM_PROMPT).toMatch(/json/i)
  })

  it("mentions facet label and rationale as required outputs", () => {
    expect(DEFAULT_CONGRUENCE_SYSTEM_PROMPT).toMatch(/facet/i)
    expect(DEFAULT_CONGRUENCE_SYSTEM_PROMPT).toMatch(/rationale/i)
  })
})

// ============================================================================
// Prompt Builder Tests
// ============================================================================

describe("buildCongruencePrompt", () => {
  const baseInput: CongruencePromptInput = {
    stem: "I seek feedback to improve my performance.",
    candidates: [
      { id: "c1", name: "Growth Mindset", definition: "Belief in personal development" },
      { id: "c2", name: "Leadership" },
      { id: "c3", name: "Collaboration", definition: "Working effectively with others" },
    ],
  }

  it("includes the item stem in the prompt", () => {
    const prompt = buildCongruencePrompt(baseInput)
    expect(prompt).toContain("I seek feedback to improve my performance.")
  })

  it("includes all candidate IDs in the prompt", () => {
    const prompt = buildCongruencePrompt(baseInput)
    expect(prompt).toContain("[c1]")
    expect(prompt).toContain("[c2]")
    expect(prompt).toContain("[c3]")
  })

  it("includes all candidate names in the prompt", () => {
    const prompt = buildCongruencePrompt(baseInput)
    expect(prompt).toContain("Growth Mindset")
    expect(prompt).toContain("Leadership")
    expect(prompt).toContain("Collaboration")
  })

  it("includes candidate definitions when provided", () => {
    const prompt = buildCongruencePrompt(baseInput)
    expect(prompt).toContain("Belief in personal development")
    expect(prompt).toContain("Working effectively with others")
  })

  it("handles candidates without definitions", () => {
    const prompt = buildCongruencePrompt(baseInput)
    // Leadership has no definition; should still appear with just the name
    expect(prompt).toContain("[c2] Leadership")
  })

  it("does NOT contain the phrase 'intended'", () => {
    const prompt = buildCongruencePrompt(baseInput)
    expect(prompt).not.toContain("intended")
  })

  it("does NOT contain the phrase 'correct answer'", () => {
    const prompt = buildCongruencePrompt(baseInput)
    expect(prompt).not.toContain("correct answer")
  })

  it("does NOT reveal which construct the item was written for", () => {
    const prompt = buildCongruencePrompt(baseInput)
    expect(prompt).not.toMatch(/written for|designed for|measures|targets/i)
  })

  it("renders candidates with ID labels for machine-readable assignment", () => {
    const prompt = buildCongruencePrompt(baseInput)
    // The format [id] name should be present for all candidates
    expect(prompt).toMatch(/\[c\d\]/)
  })

  it("works with a single candidate (edge case but valid)", () => {
    const input: CongruencePromptInput = {
      stem: "I am productive.",
      candidates: [{ id: "only", name: "Productivity" }],
    }
    const prompt = buildCongruencePrompt(input)
    expect(prompt).toContain("I am productive.")
    expect(prompt).toContain("[only]")
    expect(prompt).toContain("Productivity")
  })

  it("works with many candidates", () => {
    const manyInput: CongruencePromptInput = {
      stem: "Test item",
      candidates: Array.from({ length: 10 }, (_, i) => ({
        id: `c${i}`,
        name: `Construct ${i}`,
      })),
    }
    const prompt = buildCongruencePrompt(manyInput)
    expect(prompt).toContain("[c0]")
    expect(prompt).toContain("[c9]")
    expect(prompt).toContain("Construct 0")
    expect(prompt).toContain("Construct 9")
  })
})

// ============================================================================
// Response Parser Tests
// ============================================================================

describe("parseCongruenceResponse", () => {
  const validIds = ["c1", "c2", "c3"]

  describe("happy path", () => {
    it("parses a valid JSON object response", () => {
      const raw = JSON.stringify({
        constructId: "c1",
        relevance: 3,
        facet: "strategic thinking",
        rationale: "Item addresses planning.",
      })
      const result = parseCongruenceResponse(raw, validIds)
      expect(result.assignedConstructId).toBe("c1")
      expect(result.relevance).toBe(3)
      expect(result.namedFacet).toBe("strategic thinking")
      expect(result.rationale).toBe("Item addresses planning.")
      expect(result.warnings).toHaveLength(0)
    })

    it("parses JSON with minimal fields (only constructId)", () => {
      const raw = JSON.stringify({ constructId: "c2" })
      const result = parseCongruenceResponse(raw, validIds)
      expect(result.assignedConstructId).toBe("c2")
      expect(result.relevance).toBeUndefined()
      expect(result.namedFacet).toBeUndefined()
      expect(result.rationale).toBeUndefined()
      expect(result.warnings).toHaveLength(0)
    })

    it("accepts fenced JSON (```json...```)", () => {
      const raw = "```json\n{ \"constructId\": \"c1\", \"relevance\": 4 }\n```"
      const result = parseCongruenceResponse(raw, validIds)
      expect(result.assignedConstructId).toBe("c1")
      expect(result.relevance).toBe(4)
      expect(result.warnings).toHaveLength(0)
    })

    it("accepts fenced JSON without 'json' label (```...```)", () => {
      const raw = "```\n{ \"constructId\": \"c2\", \"relevance\": 2 }\n```"
      const result = parseCongruenceResponse(raw, validIds)
      expect(result.assignedConstructId).toBe("c2")
      expect(result.relevance).toBe(2)
    })

    it("accepts single-element array wrapping an object", () => {
      const raw = JSON.stringify([
        {
          constructId: "c3",
          relevance: 1,
          facet: "edge case",
        },
      ])
      const result = parseCongruenceResponse(raw, validIds)
      expect(result.assignedConstructId).toBe("c3")
      expect(result.relevance).toBe(1)
      expect(result.namedFacet).toBe("edge case")
    })

    it("trims whitespace from constructId and facet", () => {
      const raw = JSON.stringify({
        constructId: "  c1  ",
        facet: "  facet label  ",
      })
      const result = parseCongruenceResponse(raw, validIds)
      expect(result.assignedConstructId).toBe("c1")
      expect(result.namedFacet).toBe("facet label")
    })
  })

  describe("coercion and defaults", () => {
    it("coerces numeric string relevance to number", () => {
      const raw = JSON.stringify({ constructId: "c1", relevance: "3" })
      const result = parseCongruenceResponse(raw, validIds)
      expect(result.relevance).toBe(3)
      expect(result.warnings).toHaveLength(0)
    })

    it("clamps relevance below 1 with a warning", () => {
      const raw = JSON.stringify({ constructId: "c1", relevance: 0 })
      const result = parseCongruenceResponse(raw, validIds)
      expect(result.relevance).toBe(1)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toMatch(/clamped/i)
    })

    it("clamps relevance above 4 with a warning", () => {
      const raw = JSON.stringify({ constructId: "c1", relevance: 9 })
      const result = parseCongruenceResponse(raw, validIds)
      expect(result.relevance).toBe(4)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toMatch(/clamped/i)
    })

    it("clamps numeric-string relevance out of range", () => {
      const raw = JSON.stringify({ constructId: "c1", relevance: "10" })
      const result = parseCongruenceResponse(raw, validIds)
      expect(result.relevance).toBe(4)
      expect(result.warnings.some((w) => w.includes("clamped"))).toBe(true)
    })

    it("leaves relevance undefined if not provided", () => {
      const raw = JSON.stringify({ constructId: "c1" })
      const result = parseCongruenceResponse(raw, validIds)
      expect(result.relevance).toBeUndefined()
      expect(result.warnings).toHaveLength(0)
    })

    it("leaves facet undefined if empty string", () => {
      const raw = JSON.stringify({ constructId: "c1", facet: "" })
      const result = parseCongruenceResponse(raw, validIds)
      expect(result.namedFacet).toBeUndefined()
    })

    it("leaves facet undefined if whitespace only", () => {
      const raw = JSON.stringify({ constructId: "c1", facet: "   " })
      const result = parseCongruenceResponse(raw, validIds)
      expect(result.namedFacet).toBeUndefined()
    })

    it("leaves rationale undefined if empty string", () => {
      const raw = JSON.stringify({ constructId: "c1", rationale: "" })
      const result = parseCongruenceResponse(raw, validIds)
      expect(result.rationale).toBeUndefined()
    })
  })

  describe("validation", () => {
    it("rejects constructId not in validIds list with warning", () => {
      const raw = JSON.stringify({ constructId: "unknown", relevance: 3 })
      const result = parseCongruenceResponse(raw, validIds)
      expect(result.assignedConstructId).toBeUndefined()
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toMatch(/unknown/)
    })

    it("rejects non-string constructId with warning", () => {
      const raw = JSON.stringify({ constructId: 123, relevance: 3 })
      const result = parseCongruenceResponse(raw, validIds)
      expect(result.assignedConstructId).toBeUndefined()
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it("rejects non-numeric string relevance with warning", () => {
      const raw = JSON.stringify({ constructId: "c1", relevance: "high" })
      const result = parseCongruenceResponse(raw, validIds)
      expect(result.relevance).toBeUndefined()
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it("rejects non-string facet silently", () => {
      const raw = JSON.stringify({ constructId: "c1", facet: 123 })
      const result = parseCongruenceResponse(raw, validIds)
      expect(result.namedFacet).toBeUndefined()
      // Non-string facet is silently dropped, no warning
      expect(result.warnings).toHaveLength(0)
    })

    it("rejects non-string rationale silently", () => {
      const raw = JSON.stringify({ constructId: "c1", rationale: { text: "explanation" } })
      const result = parseCongruenceResponse(raw, validIds)
      expect(result.rationale).toBeUndefined()
      expect(result.warnings).toHaveLength(0)
    })
  })

  describe("forgiving parsing (never throws)", () => {
    it("handles null input", () => {
      const result = parseCongruenceResponse(null as unknown as string, validIds)
      expect(result.assignedConstructId).toBeUndefined()
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it("handles undefined input", () => {
      const result = parseCongruenceResponse(undefined as unknown as string, validIds)
      expect(result.assignedConstructId).toBeUndefined()
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it("handles empty string input", () => {
      const result = parseCongruenceResponse("", validIds)
      expect(result.assignedConstructId).toBeUndefined()
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it("handles whitespace-only input", () => {
      const result = parseCongruenceResponse("   \n\t   ", validIds)
      expect(result.assignedConstructId).toBeUndefined()
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it("handles invalid JSON", () => {
      const result = parseCongruenceResponse("{ this is not json }", validIds)
      expect(result.assignedConstructId).toBeUndefined()
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it("handles random text that is not JSON", () => {
      const result = parseCongruenceResponse("just some random text", validIds)
      expect(result.assignedConstructId).toBeUndefined()
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it("handles an array of non-objects", () => {
      const result = parseCongruenceResponse('["string", 123]', validIds)
      expect(result.assignedConstructId).toBeUndefined()
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it("handles a bare array with more than one element (not a single-element array)", () => {
      const result = parseCongruenceResponse(
        JSON.stringify([
          { constructId: "c1" },
          { constructId: "c2" },
        ]),
        validIds,
      )
      expect(result.assignedConstructId).toBeUndefined()
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it("handles primitive JSON values", () => {
      const resultNumber = parseCongruenceResponse("42", validIds)
      expect(resultNumber.assignedConstructId).toBeUndefined()

      const resultString = parseCongruenceResponse('"string"', validIds)
      expect(resultString.assignedConstructId).toBeUndefined()

      const resultBool = parseCongruenceResponse("true", validIds)
      expect(resultBool.assignedConstructId).toBeUndefined()
    })

    it("does not throw on any malformed input (comprehensive)", () => {
      const malformedInputs = [
        null,
        undefined,
        "",
        "{}",
        "[]",
        "[{}]",
        '{"noConstructId": true}',
        "not json at all!!!",
        '{"constructId": "unknown"}',
        '{"relevance": "invalid"}',
      ]

      for (const input of malformedInputs) {
        expect(() => parseCongruenceResponse(input as unknown as string, validIds)).not.toThrow()
      }
    })
  })

  describe("edge cases", () => {
    it("handles extra fields in JSON (ignored)", () => {
      const raw = JSON.stringify({
        constructId: "c1",
        relevance: 3,
        extraField: "should be ignored",
        anotherExtra: 999,
      })
      const result = parseCongruenceResponse(raw, validIds)
      expect(result.assignedConstructId).toBe("c1")
      expect(result.relevance).toBe(3)
      expect(result.warnings).toHaveLength(0)
    })

    it("handles constructId with special characters (if in validIds)", () => {
      const specialIds = ["c-1", "c_2", "c.3"]
      const raw = JSON.stringify({ constructId: "c-1" })
      const result = parseCongruenceResponse(raw, specialIds)
      expect(result.assignedConstructId).toBe("c-1")
    })

    it("handles very long facet and rationale strings", () => {
      const longFacet = "a".repeat(1000)
      const longRationale = "b".repeat(2000)
      const raw = JSON.stringify({
        constructId: "c1",
        facet: longFacet,
        rationale: longRationale,
      })
      const result = parseCongruenceResponse(raw, validIds)
      expect(result.namedFacet).toBe(longFacet)
      expect(result.rationale).toBe(longRationale)
    })
  })
})

// ============================================================================
// Rating Construction Tests
// ============================================================================

describe("toCongruenceRatings", () => {
  const itemId = "item-123"
  const intendedConstructId = "c1"

  describe("happy path", () => {
    it("converts a single rater result to a CongruenceRating", () => {
      const results = [
        {
          raterIndex: 0,
          raterModel: "gpt-4o",
          parsed: {
            assignedConstructId: "c1",
            relevance: 4 as const,
            namedFacet: "strategic thinking",
            warnings: [],
          },
        },
      ]
      const { ratings, warnings } = toCongruenceRatings(itemId, intendedConstructId, results)
      expect(ratings).toHaveLength(1)
      expect(ratings[0]).toMatchObject({
        itemId,
        raterIndex: 0,
        raterModel: "gpt-4o",
        assignedConstructId: "c1",
        intendedConstructId,
        relevance: 4,
        namedFacet: "strategic thinking",
      })
      expect(warnings).toHaveLength(0)
    })

    it("converts multiple rater results", () => {
      const results = [
        {
          raterIndex: 0,
          raterModel: "gpt-4o",
          parsed: {
            assignedConstructId: "c1",
            relevance: 4 as const,
            warnings: [],
          },
        },
        {
          raterIndex: 1,
          raterModel: "claude-opus",
          parsed: {
            assignedConstructId: "c2",
            relevance: 2 as const,
            warnings: [],
          },
        },
        {
          raterIndex: 2,
          raterModel: "gemini-pro",
          parsed: {
            assignedConstructId: "c1",
            relevance: 3 as const,
            warnings: [],
          },
        },
      ]
      const { ratings, warnings } = toCongruenceRatings(itemId, intendedConstructId, results)
      expect(ratings).toHaveLength(3)
      expect(ratings[0].raterModel).toBe("gpt-4o")
      expect(ratings[1].raterModel).toBe("claude-opus")
      expect(ratings[2].raterModel).toBe("gemini-pro")
      expect(warnings).toHaveLength(0)
    })

    it("includes namedFacet when provided", () => {
      const results = [
        {
          raterIndex: 0,
          raterModel: "model1",
          parsed: {
            assignedConstructId: "c1",
            relevance: 3 as const,
            namedFacet: "delegation",
            warnings: [],
          },
        },
      ]
      const { ratings } = toCongruenceRatings(itemId, intendedConstructId, results)
      expect(ratings[0].namedFacet).toBe("delegation")
    })

    it("omits namedFacet when not provided", () => {
      const results = [
        {
          raterIndex: 0,
          raterModel: "model1",
          parsed: {
            assignedConstructId: "c1",
            relevance: 3 as const,
            warnings: [],
          },
        },
      ]
      const { ratings } = toCongruenceRatings(itemId, intendedConstructId, results)
      expect("namedFacet" in ratings[0]).toBe(false)
    })
  })

  describe("handling missing or invalid fields", () => {
    it("drops rater with undefined assignedConstructId and warns", () => {
      const results = [
        {
          raterIndex: 0,
          raterModel: "model1",
          parsed: {
            assignedConstructId: undefined,
            relevance: 3 as const,
            warnings: [],
          },
        },
      ]
      const { ratings, warnings } = toCongruenceRatings(itemId, intendedConstructId, results)
      expect(ratings).toHaveLength(0)
      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings[0]).toMatch(/Rater 0/)
      expect(warnings[0]).toMatch(/no valid assignedConstructId/)
    })

    it("drops rater with null assignedConstructId and warns", () => {
      const results = [
        {
          raterIndex: 1,
          raterModel: "claude",
          parsed: {
            assignedConstructId: null as unknown as string,
            relevance: 2 as const,
            warnings: [],
          },
        },
      ]
      const { ratings, warnings } = toCongruenceRatings(itemId, intendedConstructId, results)
      expect(ratings).toHaveLength(0)
      expect(warnings.length).toBeGreaterThan(0)
    })

    it("uses default relevance of 3 when not provided", () => {
      const results = [
        {
          raterIndex: 0,
          raterModel: "model1",
          parsed: {
            assignedConstructId: "c1",
            relevance: undefined,
            warnings: [],
          },
        },
      ]
      const { ratings, warnings } = toCongruenceRatings(itemId, intendedConstructId, results)
      expect(ratings[0].relevance).toBe(3)
      expect(warnings).toHaveLength(0)
    })

    it("preserves relevance even when other fields are missing", () => {
      const results = [
        {
          raterIndex: 0,
          raterModel: "model1",
          parsed: {
            assignedConstructId: "c1",
            relevance: 1 as const,
            warnings: [],
          },
        },
      ]
      const { ratings } = toCongruenceRatings(itemId, intendedConstructId, results)
      expect(ratings[0].relevance).toBe(1)
    })
  })

  describe("mixed valid and invalid raters", () => {
    it("keeps valid raters, drops invalid ones, reports all warnings", () => {
      const results = [
        {
          raterIndex: 0,
          raterModel: "model1",
          parsed: {
            assignedConstructId: "c1",
            relevance: 4 as const,
            warnings: [],
          },
        },
        {
          raterIndex: 1,
          raterModel: "model2",
          parsed: {
            assignedConstructId: undefined,
            relevance: 3 as const,
            warnings: [],
          },
        },
        {
          raterIndex: 2,
          raterModel: "model3",
          parsed: {
            assignedConstructId: "c2",
            relevance: 2 as const,
            warnings: [],
          },
        },
      ]
      const { ratings, warnings } = toCongruenceRatings(itemId, intendedConstructId, results)
      expect(ratings).toHaveLength(2)
      expect(ratings[0].raterIndex).toBe(0)
      expect(ratings[1].raterIndex).toBe(2)
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toMatch(/Rater 1/)
    })

    it("all invalid raters results in empty ratings and warnings", () => {
      const results = [
        {
          raterIndex: 0,
          raterModel: "model1",
          parsed: { assignedConstructId: undefined, warnings: [] },
        },
        {
          raterIndex: 1,
          raterModel: "model2",
          parsed: { assignedConstructId: null as unknown as string, warnings: [] },
        },
      ]
      const { ratings, warnings } = toCongruenceRatings(itemId, intendedConstructId, results)
      expect(ratings).toHaveLength(0)
      expect(warnings).toHaveLength(2)
    })
  })

  describe("edge cases", () => {
    it("handles empty results array", () => {
      const { ratings, warnings } = toCongruenceRatings(itemId, intendedConstructId, [])
      expect(ratings).toHaveLength(0)
      expect(warnings).toHaveLength(0)
    })

    it("preserves rater model and index exactly", () => {
      const results = [
        {
          raterIndex: 5,
          raterModel: "custom-model-v2",
          parsed: {
            assignedConstructId: "construct-xyz",
            relevance: 2 as const,
            warnings: [],
          },
        },
      ]
      const { ratings } = toCongruenceRatings(itemId, intendedConstructId, results)
      expect(ratings[0].raterIndex).toBe(5)
      expect(ratings[0].raterModel).toBe("custom-model-v2")
    })

    it("preserves constructId exactly as provided", () => {
      const results = [
        {
          raterIndex: 0,
          raterModel: "model",
          parsed: {
            assignedConstructId: "c-123-xyz",
            relevance: 3 as const,
            warnings: [],
          },
        },
      ]
      const { ratings } = toCongruenceRatings(itemId, intendedConstructId, results)
      expect(ratings[0].assignedConstructId).toBe("c-123-xyz")
    })

    it("uses the exact itemId and intendedConstructId provided", () => {
      const customItemId = "custom-item-id"
      const customIntendedId = "custom-intended-id"
      const results = [
        {
          raterIndex: 0,
          raterModel: "model",
          parsed: {
            assignedConstructId: "c1",
            relevance: 3 as const,
            warnings: [],
          },
        },
      ]
      const { ratings } = toCongruenceRatings(customItemId, customIntendedId, results)
      expect(ratings[0].itemId).toBe(customItemId)
      expect(ratings[0].intendedConstructId).toBe(customIntendedId)
    })

    it("works with non-numeric rater indices", () => {
      const results = [
        {
          raterIndex: 999,
          raterModel: "model",
          parsed: {
            assignedConstructId: "c1",
            relevance: 3 as const,
            warnings: [],
          },
        },
      ]
      const { ratings } = toCongruenceRatings(itemId, intendedConstructId, results)
      expect(ratings[0].raterIndex).toBe(999)
    })
  })
})
