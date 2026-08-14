/**
 * Unit tests for the item-generation module.
 *
 * Tests prompt building (construct/facet/intensity/contrast/count inclusion),
 * intensity branching by measure type, response parsing (JSON shapes, malformed
 * entries, coercion, forgiving error handling), stem normalisation, and
 * deduplication.
 */

import { describe, it, expect } from "vitest"
import {
  DEFAULT_ITEM_GENERATION_SYSTEM_PROMPT,
  buildCellGenerationPrompt,
  parseGeneratedItems,
  normaliseStem,
  dedupeAgainst,
  type CellGenerationInput,
  type GeneratedItemDraft,
} from "@/lib/instrument/item-generation"
import type { MeasureType } from "@/lib/instrument/types"

// ============================================================================
// System Prompt Tests
// ============================================================================

describe("DEFAULT_ITEM_GENERATION_SYSTEM_PROMPT", () => {
  it("exists and is a non-empty string", () => {
    expect(typeof DEFAULT_ITEM_GENERATION_SYSTEM_PROMPT).toBe("string")
    expect(DEFAULT_ITEM_GENERATION_SYSTEM_PROMPT.length).toBeGreaterThan(0)
  })

  it("references key principles like one behaviour per stem", () => {
    expect(DEFAULT_ITEM_GENERATION_SYSTEM_PROMPT).toMatch(/one behaviour per stem/i)
  })

  it("instructs format as JSON array", () => {
    expect(DEFAULT_ITEM_GENERATION_SYSTEM_PROMPT).toMatch(/json.*array/i)
  })
})

// ============================================================================
// Prompt Builder Tests
// ============================================================================

describe("buildCellGenerationPrompt", () => {
  const baseInput: CellGenerationInput = {
    constructName: "Leadership",
    measureType: "competency_behavioural",
    facetLabel: "Strategic Thinking",
    intensity: "mid",
    count: 5,
  }

  it("includes construct name in prompt", () => {
    const prompt = buildCellGenerationPrompt(baseInput)
    expect(prompt).toContain("Leadership")
  })

  it("includes facet label in prompt", () => {
    const prompt = buildCellGenerationPrompt(baseInput)
    expect(prompt).toContain("Strategic Thinking")
  })

  it("includes facet definition when provided", () => {
    const input: CellGenerationInput = {
      ...baseInput,
      facetDefinition: "The ability to think beyond immediate concerns",
    }
    const prompt = buildCellGenerationPrompt(input)
    expect(prompt).toContain("The ability to think beyond immediate concerns")
  })

  it("includes target item count", () => {
    const prompt = buildCellGenerationPrompt(baseInput)
    expect(prompt).toMatch(/exactly 5 items/i)
  })

  it("includes sibling facets when provided", () => {
    const input: CellGenerationInput = {
      ...baseInput,
      siblingFacets: [
        { facetLabel: "Execution", facetDefinition: "Getting things done" },
        { facetLabel: "Communication" },
      ],
    }
    const prompt = buildCellGenerationPrompt(input)
    expect(prompt).toContain("Execution")
    expect(prompt).toContain("Getting things done")
    expect(prompt).toContain("Communication")
  })

  it("includes exclusions when provided", () => {
    const input: CellGenerationInput = {
      ...baseInput,
      exclusions: ["Perfectionism", "Analysis paralysis"],
    }
    const prompt = buildCellGenerationPrompt(input)
    expect(prompt).toContain("Perfectionism")
    expect(prompt).toContain("Analysis paralysis")
  })

  it("includes response format description when provided", () => {
    const input: CellGenerationInput = {
      ...baseInput,
      responseFormatDescription: "Use a 5-point Likert scale",
    }
    const prompt = buildCellGenerationPrompt(input)
    expect(prompt).toContain("5-point Likert scale")
  })

  it("includes existing stems to avoid when provided", () => {
    const input: CellGenerationInput = {
      ...baseInput,
      existingStems: ["I think strategically", "I plan ahead"],
    }
    const prompt = buildCellGenerationPrompt(input)
    expect(prompt).toContain("I think strategically")
    expect(prompt).toContain("I plan ahead")
  })

  it("includes audience level when provided", () => {
    const input: CellGenerationInput = {
      ...baseInput,
      audienceLevel: "mid-career managers",
    }
    const prompt = buildCellGenerationPrompt(input)
    expect(prompt).toContain("mid-career managers")
  })

  it("includes use context when provided", () => {
    const input: CellGenerationInput = {
      ...baseInput,
      useContext: "selection",
    }
    const prompt = buildCellGenerationPrompt(input)
    expect(prompt).toContain("selection")
  })

  it("caps existing stems display at 10 items", () => {
    const input: CellGenerationInput = {
      ...baseInput,
      existingStems: Array.from({ length: 15 }, (_, i) => `Stem ${i}`),
    }
    const prompt = buildCellGenerationPrompt(input)
    expect(prompt).toContain("Stem 0")
    expect(prompt).toContain("Stem 9")
    expect(prompt).toMatch(/5 more existing stems omitted/i)
  })
})

// ============================================================================
// Intensity Guidance Tests — Measure Type Branching
// ============================================================================

describe("Intensity guidance by measure type", () => {
  describe("Endorsement threshold types (trait/competency/preference/climate)", () => {
    const types: MeasureType[] = [
      "trait",
      "competency_behavioural",
      "preference",
      "climate",
    ]

    types.forEach(measureType => {
      describe(measureType, () => {
        it("low intensity: mentions baseline / most people / accessible / entry point", () => {
          const input: CellGenerationInput = {
            constructName: "Test",
            measureType,
            facetLabel: "TestFacet",
            intensity: "low",
            count: 1,
          }
          const prompt = buildCellGenerationPrompt(input)
          const guidanceRegex = /low.*baseline|most people|accessible|entry point/i
          expect(prompt).toMatch(guidanceRegex)
        })

        it("mid intensity: mentions middle / discriminate / typical", () => {
          const input: CellGenerationInput = {
            constructName: "Test",
            measureType,
            facetLabel: "TestFacet",
            intensity: "mid",
            count: 1,
          }
          const prompt = buildCellGenerationPrompt(input)
          const guidanceRegex = /mid.*middle|discriminate|typical|range/i
          expect(prompt).toMatch(guidanceRegex)
        })

        it("high intensity: mentions few / aspiration / strong / discriminating", () => {
          const input: CellGenerationInput = {
            constructName: "Test",
            measureType,
            facetLabel: "TestFacet",
            intensity: "high",
            count: 1,
          }
          const prompt = buildCellGenerationPrompt(input)
          const guidanceRegex = /high.*(few|aspiration|strong|discriminat)/i
          expect(prompt).toMatch(guidanceRegex)
        })
      })
    })
  })

  describe("Difficulty types (capability/sjt)", () => {
    const types: MeasureType[] = ["capability", "sjt"]

    types.forEach(measureType => {
      describe(measureType, () => {
        it("low intensity: mentions foundational / baseline", () => {
          const input: CellGenerationInput = {
            constructName: "Test",
            measureType,
            facetLabel: "TestFacet",
            intensity: "low",
            count: 1,
          }
          const prompt = buildCellGenerationPrompt(input)
          expect(prompt).toMatch(/low.*foundational|baseline|easy/i)
        })

        it("mid intensity: mentions applied / moderately", () => {
          const input: CellGenerationInput = {
            constructName: "Test",
            measureType,
            facetLabel: "TestFacet",
            intensity: "mid",
            count: 1,
          }
          const prompt = buildCellGenerationPrompt(input)
          expect(prompt).toMatch(/mid.*applied|moderately/i)
        })

        it("high intensity: mentions demanding / advanced / ceiling", () => {
          const input: CellGenerationInput = {
            constructName: "Test",
            measureType,
            facetLabel: "TestFacet",
            intensity: "high",
            count: 1,
          }
          const prompt = buildCellGenerationPrompt(input)
          expect(prompt).toMatch(/high.*demanding|advanced|ceiling/i)
        })
      })
    })
  })

  describe("validity_scale", () => {
    it("says intensity is not meaningful for validity scales", () => {
      const input: CellGenerationInput = {
        constructName: "Test",
        measureType: "validity_scale",
        facetLabel: "TestFacet",
        intensity: "low",
        count: 1,
      }
      const prompt = buildCellGenerationPrompt(input)
      expect(prompt).toMatch(/validity scale|intensity is not meaningful/i)
    })
  })
})

// ============================================================================
// Response Parser Tests
// ============================================================================

describe("parseGeneratedItems", () => {
  describe("valid JSON shapes", () => {
    it("parses bare JSON array", () => {
      const json = JSON.stringify([
        { stem: "Item 1", reverseScored: false },
        { stem: "Item 2", reverseScored: true },
      ])
      const result = parseGeneratedItems(json)
      expect(result.items).toHaveLength(2)
      expect(result.items[0]!.stem).toBe("Item 1")
      expect(result.items[0]!.reverseScored).toBe(false)
      expect(result.items[1]!.reverseScored).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it("parses wrapped object with items array", () => {
      const json = JSON.stringify({
        items: [{ stem: "Item 1", reverseScored: false }],
      })
      const result = parseGeneratedItems(json)
      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.stem).toBe("Item 1")
      expect(result.warnings).toHaveLength(0)
    })

    it("parses fenced JSON (```json...```)", () => {
      const fenced =
        '```json\n[{ "stem": "Item 1", "reverseScored": false }]\n```'
      const result = parseGeneratedItems(fenced)
      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.stem).toBe("Item 1")
      expect(result.warnings).toHaveLength(0)
    })

    it("parses fenced JSON with plain code fence (```...```)", () => {
      const fenced = '```\n[{ "stem": "Item 1", "reverseScored": false }]\n```'
      const result = parseGeneratedItems(fenced)
      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.stem).toBe("Item 1")
      expect(result.warnings).toHaveLength(0)
    })
  })

  describe("optional fields", () => {
    it("includes rationale when present", () => {
      const json = JSON.stringify([
        {
          stem: "Item 1",
          reverseScored: false,
          rationale: "Tests leadership",
        },
      ])
      const result = parseGeneratedItems(json)
      expect(result.items[0]!.rationale).toBe("Tests leadership")
    })

    it("includes sdRisk when present", () => {
      const json = JSON.stringify([
        {
          stem: "Item 1",
          reverseScored: false,
          sdRisk: "high",
        },
      ])
      const result = parseGeneratedItems(json)
      expect(result.items[0]!.sdRisk).toBe("high")
    })

    it("includes facet when present", () => {
      const json = JSON.stringify([
        {
          stem: "Item 1",
          reverseScored: false,
          facet: "Leadership",
        },
      ])
      const result = parseGeneratedItems(json)
      expect(result.items[0]!.facet).toBe("Leadership")
    })

    it("omits optional fields when not present", () => {
      const json = JSON.stringify([
        { stem: "Item 1", reverseScored: false },
      ])
      const result = parseGeneratedItems(json)
      expect(result.items[0]!.rationale).toBeUndefined()
      expect(result.items[0]!.sdRisk).toBeUndefined()
      expect(result.items[0]!.facet).toBeUndefined()
    })
  })

  describe("reverseScored coercion", () => {
    it("accepts boolean true", () => {
      const json = JSON.stringify([
        { stem: "Item", reverseScored: true },
      ])
      const result = parseGeneratedItems(json)
      expect(result.items[0]!.reverseScored).toBe(true)
    })

    it("accepts boolean false", () => {
      const json = JSON.stringify([
        { stem: "Item", reverseScored: false },
      ])
      const result = parseGeneratedItems(json)
      expect(result.items[0]!.reverseScored).toBe(false)
    })

    it('accepts string "true" (case-insensitive)', () => {
      const json = JSON.stringify([
        { stem: "Item 1", reverseScored: "true" },
        { stem: "Item 2", reverseScored: "TRUE" },
      ])
      const result = parseGeneratedItems(json)
      expect(result.items[0]!.reverseScored).toBe(true)
      expect(result.items[1]!.reverseScored).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('accepts string "false" (case-insensitive)', () => {
      const json = JSON.stringify([
        { stem: "Item 1", reverseScored: "false" },
        { stem: "Item 2", reverseScored: "FALSE" },
      ])
      const result = parseGeneratedItems(json)
      expect(result.items[0]!.reverseScored).toBe(false)
      expect(result.items[1]!.reverseScored).toBe(false)
      expect(result.warnings).toHaveLength(0)
    })

    it("defaults to false on unknown reverseScored type and warns", () => {
      const json = JSON.stringify([
        { stem: "Item", reverseScored: "maybe" },
      ])
      const result = parseGeneratedItems(json)
      expect(result.items[0]!.reverseScored).toBe(false)
      expect(result.warnings.some(w => w.includes("reverseScored"))).toBe(true)
    })
  })

  describe("sdRisk validation", () => {
    it("accepts low, moderate, high (case-insensitive)", () => {
      const json = JSON.stringify([
        { stem: "Item 1", reverseScored: false, sdRisk: "low" },
        { stem: "Item 2", reverseScored: false, sdRisk: "MODERATE" },
        { stem: "Item 3", reverseScored: false, sdRisk: "High" },
      ])
      const result = parseGeneratedItems(json)
      expect(result.items[0]!.sdRisk).toBe("low")
      expect(result.items[1]!.sdRisk).toBe("moderate")
      expect(result.items[2]!.sdRisk).toBe("high")
      expect(result.warnings).toHaveLength(0)
    })

    it("drops unknown sdRisk and warns", () => {
      const json = JSON.stringify([
        { stem: "Item", reverseScored: false, sdRisk: "extreme" },
      ])
      const result = parseGeneratedItems(json)
      expect(result.items[0]!.sdRisk).toBeUndefined()
      expect(result.warnings.some(w => w.includes("unknown sdRisk"))).toBe(true)
    })

    it("omits sdRisk when null/undefined", () => {
      const json = JSON.stringify([
        { stem: "Item 1", reverseScored: false, sdRisk: null },
        { stem: "Item 2", reverseScored: false },
      ])
      const result = parseGeneratedItems(json)
      expect(result.items[0]!.sdRisk).toBeUndefined()
      expect(result.items[1]!.sdRisk).toBeUndefined()
    })
  })

  describe("stem validation", () => {
    it("skips items with empty stem and warns", () => {
      const json = JSON.stringify([
        { stem: "", reverseScored: false },
        { stem: "  ", reverseScored: false },
        { stem: "Valid stem", reverseScored: false },
      ])
      const result = parseGeneratedItems(json)
      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.stem).toBe("Valid stem")
      expect(result.warnings.some(w => w.includes("empty stem"))).toBe(true)
    })

    it("skips items with missing stem field and warns", () => {
      const json = JSON.stringify([
        { reverseScored: false },
        { stem: "Valid", reverseScored: false },
      ])
      const result = parseGeneratedItems(json)
      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.stem).toBe("Valid")
      expect(result.warnings.some(w => w.includes("empty stem"))).toBe(true)
    })
  })

  describe("malformed entries", () => {
    it("skips non-object items and warns", () => {
      const json = JSON.stringify([
        "not an object",
        { stem: "Valid", reverseScored: false },
        null,
        { stem: "Another", reverseScored: true },
      ])
      const result = parseGeneratedItems(json)
      expect(result.items).toHaveLength(2)
      expect(result.items[0]!.stem).toBe("Valid")
      expect(result.items[1]!.stem).toBe("Another")
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it("continues parsing after malformed entries", () => {
      const json = JSON.stringify([
        { stem: "First", reverseScored: false },
        { somethingElse: "not a stem" },
        { stem: "Last", reverseScored: false },
      ])
      const result = parseGeneratedItems(json)
      expect(result.items).toHaveLength(2)
      expect(result.items[0]!.stem).toBe("First")
      expect(result.items[1]!.stem).toBe("Last")
      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })

  describe("invalid input handling (forgiving)", () => {
    it("returns empty items on null input with warning", () => {
      const result = parseGeneratedItems(null as unknown as string)
      expect(result.items).toHaveLength(0)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it("returns empty items on undefined input with warning", () => {
      const result = parseGeneratedItems(undefined as unknown as string)
      expect(result.items).toHaveLength(0)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it("returns empty items on empty string with warning", () => {
      const result = parseGeneratedItems("")
      expect(result.items).toHaveLength(0)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it("returns empty items on whitespace-only string with warning", () => {
      const result = parseGeneratedItems("   \n  \t  ")
      expect(result.items).toHaveLength(0)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it("returns empty items on invalid JSON with warning", () => {
      const result = parseGeneratedItems("{this is not json")
      expect(result.items).toHaveLength(0)
      expect(result.warnings.some(w => w.includes("valid JSON"))).toBe(true)
    })

    it("returns empty items on object with no items array with warning", () => {
      const result = parseGeneratedItems(JSON.stringify({ data: [] }))
      expect(result.items).toHaveLength(0)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it("never throws on garbage input", () => {
      expect(() => parseGeneratedItems("🚀💀🎉")).not.toThrow()
      expect(() => parseGeneratedItems(`{"items": "${Buffer.alloc(10000)}"}`)).not.toThrow()
      expect(() => parseGeneratedItems('{"items": [' + "[".repeat(1000))).not.toThrow()
    })
  })
})

// ============================================================================
// Stem Normalization Tests
// ============================================================================

describe("normaliseStem", () => {
  it("lowercases the input", () => {
    expect(normaliseStem("UPPERCASE")).toBe("uppercase")
    expect(normaliseStem("MiXeD Case")).toBe("mixed case")
  })

  it("strips punctuation and special characters", () => {
    expect(normaliseStem("I'm happy!")).toBe("i m happy")
    expect(normaliseStem("Don't-worry, OK?")).toBe("don t worry ok")
  })

  it("collapses multiple whitespaces to single space", () => {
    expect(normaliseStem("I  love   this")).toBe("i love this")
    expect(normaliseStem("hello\n\nworld")).toBe("hello world")
    expect(normaliseStem("tab\t\ttab")).toBe("tab tab")
  })

  it("trims leading and trailing whitespace", () => {
    expect(normaliseStem("  leading")).toBe("leading")
    expect(normaliseStem("trailing  ")).toBe("trailing")
    expect(normaliseStem("  both  ")).toBe("both")
  })

  it("handles empty string", () => {
    expect(normaliseStem("")).toBe("")
  })

  it("handles whitespace-only string", () => {
    expect(normaliseStem("   \n\t  ")).toBe("")
  })

  it("treats punctuation-only string as empty after normalisation", () => {
    expect(normaliseStem("!!!")).toBe("")
    expect(normaliseStem("???")).toBe("")
  })

  it("normalises realistic duplicate stems identically", () => {
    const stem1 = "I am willing to help!"
    const stem2 = "I am willing to help"
    const stem3 = "i am  willing  to  help!!!"
    expect(normaliseStem(stem1)).toBe(normaliseStem(stem2))
    expect(normaliseStem(stem1)).toBe(normaliseStem(stem3))
  })
})

// ============================================================================
// Deduplication Tests
// ============================================================================

describe("dedupeAgainst", () => {
  const baseDraft = (stem: string): GeneratedItemDraft => ({
    stem,
    reverseScored: false,
  })

  describe("against existing stems", () => {
    it("keeps items whose normalised stem is unique", () => {
      const drafts = [
        baseDraft("I am happy"),
        baseDraft("I am sad"),
      ]
      const result = dedupeAgainst(drafts, [])
      expect(result.kept).toHaveLength(2)
      expect(result.duplicates).toHaveLength(0)
    })

    it("removes items matching existing stems (case-insensitive)", () => {
      const drafts = [
        baseDraft("I am happy"),
        baseDraft("I am sad"),
      ]
      const existing = ["i am HAPPY"]
      const result = dedupeAgainst(drafts, existing)
      expect(result.kept).toHaveLength(1)
      expect(result.kept[0]!.stem).toBe("I am sad")
      expect(result.duplicates).toContain("I am happy")
    })

    it("removes items matching existing stems after punctuation normalisation", () => {
      const drafts = [
        baseDraft("I am happy!"),
      ]
      const existing = ["I am happy"]
      const result = dedupeAgainst(drafts, existing)
      expect(result.kept).toHaveLength(0)
      expect(result.duplicates).toContain("I am happy!")
    })

    it("handles no existing stems (undefined)", () => {
      const drafts = [
        baseDraft("I am happy"),
      ]
      const result = dedupeAgainst(drafts, undefined)
      expect(result.kept).toHaveLength(1)
      expect(result.duplicates).toHaveLength(0)
    })

    it("handles empty existing stems array", () => {
      const drafts = [
        baseDraft("I am happy"),
      ]
      const result = dedupeAgainst(drafts, [])
      expect(result.kept).toHaveLength(1)
      expect(result.duplicates).toHaveLength(0)
    })
  })

  describe("within-batch duplicates", () => {
    it("catches duplicate stems within the batch", () => {
      const drafts = [
        baseDraft("I am happy"),
        baseDraft("I am happy"),
      ]
      const result = dedupeAgainst(drafts, [])
      expect(result.kept).toHaveLength(1)
      expect(result.duplicates).toHaveLength(1)
      expect(result.duplicates[0]).toBe("I am happy")
    })

    it("keeps first occurrence, removes later occurrences", () => {
      const drafts = [
        baseDraft("I am happy"),
        baseDraft("I am sad"),
        baseDraft("I am happy!"),
        baseDraft("I am excited"),
      ]
      const result = dedupeAgainst(drafts, [])
      expect(result.kept).toHaveLength(3)
      expect(result.kept[0]!.stem).toBe("I am happy")
      expect(result.kept[1]!.stem).toBe("I am sad")
      expect(result.kept[2]!.stem).toBe("I am excited")
      expect(result.duplicates).toContain("I am happy!")
    })

    it("catches case-insensitive duplicates within batch", () => {
      const drafts = [
        baseDraft("I am HAPPY"),
        baseDraft("i am happy"),
      ]
      const result = dedupeAgainst(drafts, [])
      expect(result.kept).toHaveLength(1)
      expect(result.kept[0]!.stem).toBe("I am HAPPY")
      expect(result.duplicates).toHaveLength(1)
      expect(result.duplicates[0]).toBe("i am happy")
    })

    it("catches punctuation-normalised duplicates within batch", () => {
      const drafts = [
        baseDraft("I am happy!"),
        baseDraft("I am happy"),
      ]
      const result = dedupeAgainst(drafts, [])
      expect(result.kept).toHaveLength(1)
      expect(result.kept[0]!.stem).toBe("I am happy!")
      expect(result.duplicates).toHaveLength(1)
      expect(result.duplicates[0]).toBe("I am happy")
    })
  })

  describe("combined (existing + within-batch)", () => {
    it("dedupes against both existing and within-batch", () => {
      const drafts = [
        baseDraft("I am happy"),
        baseDraft("I am happy"),
        baseDraft("I am sad"),
      ]
      const existing = ["I am excited"]
      const result = dedupeAgainst(drafts, existing)
      expect(result.kept).toHaveLength(2)
      expect(result.duplicates).toHaveLength(1)
      expect(result.duplicates[0]).toBe("I am happy")
    })

    it("returns full stem text in duplicates array", () => {
      const drafts = [
        baseDraft("I am feeling great!"),
      ]
      const existing = ["i am feeling great"]
      const result = dedupeAgainst(drafts, existing)
      expect(result.duplicates).toContain("I am feeling great!")
    })
  })

  describe("edge cases", () => {
    it("handles empty drafts array", () => {
      const result = dedupeAgainst([], ["existing"])
      expect(result.kept).toHaveLength(0)
      expect(result.duplicates).toHaveLength(0)
    })

    it("handles empty drafts with empty existing", () => {
      const result = dedupeAgainst([], [])
      expect(result.kept).toHaveLength(0)
      expect(result.duplicates).toHaveLength(0)
    })

    it("preserves full item objects in kept array", () => {
      const draft: GeneratedItemDraft = {
        stem: "I am happy",
        reverseScored: true,
        rationale: "Tests happiness",
        sdRisk: "high",
      }
      const result = dedupeAgainst([draft], [])
      expect(result.kept).toHaveLength(1)
      expect(result.kept[0]).toEqual(draft)
    })
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe("Integration: prompt → parse → dedupe flow", () => {
  it("generates, parses, and dedupes a full cell generation cycle", () => {
    // Build a prompt
    const input: CellGenerationInput = {
      constructName: "Communication",
      facetLabel: "Active Listening",
      intensity: "mid",
      count: 3,
      measureType: "competency_behavioural",
      existingStems: ["I listen to others carefully"],
    }
    const prompt = buildCellGenerationPrompt(input)

    // Verify prompt contains key elements
    expect(prompt).toContain("Communication")
    expect(prompt).toContain("Active Listening")
    expect(prompt).toContain("exactly 3 items")
    expect(prompt).toContain("I listen to others carefully")

    // Simulate model response
    const modelResponse = JSON.stringify([
      { stem: "I listen to others carefully", reverseScored: false },
      { stem: "I often interrupt people", reverseScored: true },
      { stem: "I ask questions to understand better", reverseScored: false },
    ])

    // Parse
    const parsed = parseGeneratedItems(modelResponse)
    expect(parsed.items).toHaveLength(3)
    expect(parsed.warnings).toHaveLength(0)

    // Dedupe against existing
    const deduped = dedupeAgainst(parsed.items, input.existingStems)
    expect(deduped.kept).toHaveLength(2)
    expect(deduped.duplicates).toContain("I listen to others carefully")
  })

  it("handles real-world response with formatting quirks", () => {
    // Simulate a fenced, wrapped response with optional fields
    const messyResponse = `
    \`\`\`json
    {
      "items": [
        {
          "stem": "I ask thoughtful questions.",
          "reverseScored": false,
          "rationale": "Shows curiosity",
          "sdRisk": "low"
        },
        {
          "stem": "I dominate conversations.",
          "reverseScored": true,
          "rationale": "Reverse-scored",
          "sdRisk": "MODERATE"
        },
        {
          "stem": "I avoid speaking up.",
          "reverseScored": "maybe"
        },
        {
          "stem": "",
          "reverseScored": true
        }
      ]
    }
    \`\`\`
    `

    const result = parseGeneratedItems(messyResponse)
    expect(result.items).toHaveLength(3)
    expect(result.items[0]!.stem).toBe("I ask thoughtful questions.")
    expect(result.items[0]!.sdRisk).toBe("low")
    expect(result.items[1]!.reverseScored).toBe(true)
    expect(result.items[1]!.sdRisk).toBe("moderate")
    expect(result.items[2]!.reverseScored).toBe(false)
    expect(result.warnings.some(w => w.includes("empty stem"))).toBe(true)
    expect(result.warnings.some(w => w.includes("reverseScored"))).toBe(true)
  })
})
