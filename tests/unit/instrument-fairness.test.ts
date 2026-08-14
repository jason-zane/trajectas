import { describe, expect, it } from "vitest";
import {
  assessReadingGrade,
  buildFairnessPrompt,
  countSyllables,
  DEFAULT_FAIRNESS_SYSTEM_PROMPT,
  fleschKincaidGrade,
  parseFairnessResponse,
  READING_GRADE_CEILING_BY_AUDIENCE,
} from "@/lib/instrument/fairness";

describe("Instrument Fairness Assessment", () => {
  // ---------------------------------------------------------------------------
  // Syllable Counting Tests
  // ---------------------------------------------------------------------------

  describe("countSyllables", () => {
    it("counts syllables correctly for simple words", () => {
      expect(countSyllables("the")).toBe(1);
      // 'people' = p-e-o-p-l-e: vowel group 'e', then 'o', then 'e' → but consecutive 'eo' is one group
      // So groups are: 'e', 'o', 'e' but algorithm sees 'eo' as one → count=2, ends with 'e' → -1 = 1
      // This is a quirk of the simple algorithm (actual word is 2 syllables)
      expect(countSyllables("people")).toBe(1);
      expect(countSyllables("make")).toBe(1);
      expect(countSyllables("strengthen")).toBe(2);
    });

    it("counts syllables for multi-syllable words", () => {
      // 'idea' = i-d-e-a: vowel groups 'i', 'e-a' (consecutive) → count=2
      // Ends with 'a' not 'e', so no silent-e adjustment. Result: 2.
      // Note: actual word is 3 syllables (eye-DEE-uh), but simple heuristic gives 2.
      expect(countSyllables("idea")).toBe(2);
    });

    it("applies silent-e adjustment correctly", () => {
      // 'hope' has one vowel group 'o-e' (counts as 1), with silent-e adjustment = 1 - 1 = 0, clamped to 1
      expect(countSyllables("hope")).toBe(1);
      // 'care' has one vowel group 'a-e', silent-e adjustment = 1 - 1 = 0, clamped to 1
      expect(countSyllables("care")).toBe(1);
      // 'apple' has two groups 'a' and 'e', silent-e adjustment = 2 - 1 = 1
      expect(countSyllables("apple")).toBe(1);
    });

    it("handles words without vowels", () => {
      expect(countSyllables("cry")).toBe(1); // 'y' is a vowel, so 'ry' is one group
      expect(countSyllables("gym")).toBe(1); // 'y' is a vowel, counts as 1
    });

    it("strips non-letters before counting", () => {
      expect(countSyllables("don't")).toBe(1); // 'dont' → one vowel group 'o'
      expect(countSyllables("co-worker")).toBe(3); // 'coworker' → 'o', 'o', 'e' = 3 groups
    });

    it("is case-insensitive", () => {
      expect(countSyllables("THE")).toBe(1);
      expect(countSyllables("PeOPle")).toBe(1); // same as "people"
    });

    it("returns minimum 1 syllable for any input", () => {
      expect(countSyllables("")).toBe(1);
      expect(countSyllables("123")).toBe(1);
      expect(countSyllables("---")).toBe(1);
      expect(countSyllables("a")).toBe(1);
    });

    it("counts words ending in 'e' with single vowel group", () => {
      // 'be' has one vowel group 'e', silent-e check: 1 > 1? No, so no adjustment
      expect(countSyllables("be")).toBe(1);
      // 'are' has one vowel group 'a-e', silent-e: 1 > 1? No, so no adjustment
      expect(countSyllables("are")).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Flesch-Kincaid Grade Tests
  // ---------------------------------------------------------------------------

  describe("fleschKincaidGrade", () => {
    it("returns 0 for empty or whitespace-only input", () => {
      expect(fleschKincaidGrade("")).toBe(0);
      expect(fleschKincaidGrade("   ")).toBe(0);
      expect(fleschKincaidGrade("\n\t")).toBe(0);
    });

    it("treats text without terminal punctuation as one sentence", () => {
      // Simple test: "The cat sat" (3 words, 1 sentence)
      // Syllables: the(1) + cat(1) + sat(1) = 3
      // FK = 0.39 * (3/1) + 11.8 * (3/3) - 15.59
      //    = 0.39 * 3 + 11.8 * 1 - 15.59
      //    = 1.17 + 11.8 - 15.59
      //    = -2.62, clamped to 0
      expect(fleschKincaidGrade("The cat sat")).toBeCloseTo(0, 1);
    });

    it("computes grade for a simple, clear sentence", () => {
      // "I am." (1 sentence, 2 words)
      // Syllables: I(1) + am(1) = 2
      // FK = 0.39 * (2/1) + 11.8 * (2/2) - 15.59
      //    = 0.39 * 2 + 11.8 * 1 - 15.59
      //    = 0.78 + 11.8 - 15.59
      //    = -3.01, clamped to 0
      expect(fleschKincaidGrade("I am.")).toBeCloseTo(0, 1);
    });

    it("computes grade for a moderately complex sentence", () => {
      // "The quick brown fox jumps over the lazy dog."
      // Words: the(1), quick(1), brown(1), fox(1), jumps(1), over(2), the(1), lazy(2), dog(1) = 9 words
      // Syllables: 1+1+1+1+1+2+1+2+1 = 11
      // Sentences: 1
      // FK = 0.39 * (9/1) + 11.8 * (11/9) - 15.59
      //    = 0.39 * 9 + 11.8 * 1.222... - 15.59
      //    = 3.51 + 14.42 - 15.59
      //    = 2.34
      const grade = fleschKincaidGrade(
        "The quick brown fox jumps over the lazy dog."
      );
      expect(grade).toBeCloseTo(2.34, 1);
    });

    it("handles multiple sentences correctly", () => {
      // "See cat. Run fast."
      // Words: see(1), cat(1), run(1), fast(1) = 4 words
      // Syllables: 1+1+1+1 = 4
      // Sentences: 2
      // FK = 0.39 * (4/2) + 11.8 * (4/4) - 15.59
      //    = 0.39 * 2 + 11.8 * 1 - 15.59
      //    = 0.78 + 11.8 - 15.59
      //    = -3.01, clamped to 0
      expect(fleschKincaidGrade("See cat. Run fast.")).toBeCloseTo(0, 1);
    });

    it("handles punctuation like ! and ? correctly", () => {
      // "Do it! Why?" (2 sentences split on [.!?]+)
      // After splitting on [.!?]+: ["Do it", " Why", ""] → filter blanks → ["Do it", "Why"]
      // Words: do(1), it(1), why(1) = 3 words
      // Syllables: 1+1+1 = 3
      // Sentences: 2
      // FK = 0.39 * (3/2) + 11.8 * (3/3) - 15.59
      //    = 0.39 * 1.5 + 11.8 * 1 - 15.59
      //    = 0.585 + 11.8 - 15.59
      //    = -3.205, clamped to 0
      expect(fleschKincaidGrade("Do it! Why?")).toBeCloseTo(0, 1);
    });

    it("rejects negative grades (floor at 0)", () => {
      // Very simple text should not produce negative grades
      const simple = "Go. Run.";
      const grade = fleschKincaidGrade(simple);
      expect(grade).toBeGreaterThanOrEqual(0);
    });

    it("computes reasonable grades for typical test items", () => {
      // Higher-grade text: "The organizational dynamics within complex systems require strategic analysis and continuous adaptation."
      // Let's just verify it produces a non-negative number in the normal range
      const complexText =
        "The organizational dynamics within complex systems require strategic analysis and continuous adaptation.";
      const grade = fleschKincaidGrade(complexText);
      expect(grade).toBeGreaterThanOrEqual(0);
      expect(grade).toBeLessThan(30); // Sanity check: shouldn't be absurdly high
    });

    it("handles text with no words (only punctuation)", () => {
      expect(fleschKincaidGrade("!!!")).toBe(0);
      expect(fleschKincaidGrade("...")).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Reading Grade Assessment
  // ---------------------------------------------------------------------------

  describe("assessReadingGrade", () => {
    it("returns correct ceiling for known audience levels", () => {
      expect(assessReadingGrade("Test item", "entry").ceiling).toBe(8);
      expect(assessReadingGrade("Test item", "mid").ceiling).toBe(10);
      expect(assessReadingGrade("Test item", "senior").ceiling).toBe(12);
      expect(assessReadingGrade("Test item", "executive").ceiling).toBe(14);
      expect(assessReadingGrade("Test item", "mixed").ceiling).toBe(10);
    });

    it("defaults to mixed audience (ceiling 10)", () => {
      expect(assessReadingGrade("Test item").ceiling).toBe(10);
    });

    it("handles unknown audience levels", () => {
      expect(assessReadingGrade("Test item", "unknown").ceiling).toBe(10);
    });

    it("correctly identifies when grade exceeds ceiling", () => {
      // "I am." is very simple (grade ~0 as tested above)
      const simple = assessReadingGrade("I am.", "entry");
      expect(simple.exceedsCeiling).toBe(false);

      // Complex text should exceed a low ceiling
      const complex =
        "The organizational dynamics within complex systems require strategic analysis and continuous adaptation.";
      const result = assessReadingGrade(complex, "entry");
      expect(result.exceedsCeiling).toBe(true);
    });

    it("includes grade and ceiling in result", () => {
      const result = assessReadingGrade("See cat.", "mid");
      expect(result).toHaveProperty("grade");
      expect(result).toHaveProperty("ceiling");
      expect(result).toHaveProperty("exceedsCeiling");
      expect(typeof result.grade).toBe("number");
      expect(typeof result.ceiling).toBe("number");
      expect(typeof result.exceedsCeiling).toBe("boolean");
    });
  });

  // ---------------------------------------------------------------------------
  // System Prompt
  // ---------------------------------------------------------------------------

  describe("DEFAULT_FAIRNESS_SYSTEM_PROMPT", () => {
    it("exists and is a non-empty string", () => {
      expect(typeof DEFAULT_FAIRNESS_SYSTEM_PROMPT).toBe("string");
      expect(DEFAULT_FAIRNESS_SYSTEM_PROMPT.length).toBeGreaterThan(100);
    });

    it("includes guidance on fairness dimensions", () => {
      // The prompt uses capitalized labels (Idiom, Metaphor, etc.)
      expect(DEFAULT_FAIRNESS_SYSTEM_PROMPT.toLowerCase()).toContain("idiom");
      expect(DEFAULT_FAIRNESS_SYSTEM_PROMPT.toLowerCase()).toContain("metaphor");
      expect(DEFAULT_FAIRNESS_SYSTEM_PROMPT.toLowerCase()).toContain("sensory");
      expect(DEFAULT_FAIRNESS_SYSTEM_PROMPT.toLowerCase()).toContain("protected");
    });

    it("emphasizes false-positive risk", () => {
      expect(DEFAULT_FAIRNESS_SYSTEM_PROMPT).toContain("False positive");
    });
  });

  // ---------------------------------------------------------------------------
  // Prompt Builder
  // ---------------------------------------------------------------------------

  describe("buildFairnessPrompt", () => {
    it("returns a non-empty string", () => {
      const prompt = buildFairnessPrompt([]);
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("includes item IDs and stems for non-empty input", () => {
      const items = [
        { id: "item-1", stem: "What is your opinion?" },
        { id: "item-2", stem: "How do you feel?" },
      ];
      const prompt = buildFairnessPrompt(items);

      expect(prompt).toContain("item-1");
      expect(prompt).toContain("item-2");
      expect(prompt).toContain("What is your opinion?");
      expect(prompt).toContain("How do you feel?");
    });

    it("includes JSON format instructions", () => {
      const prompt = buildFairnessPrompt([
        { id: "test", stem: "Test" },
      ]);
      expect(prompt).toContain("JSON");
      expect(prompt).toContain("flags");
      expect(prompt).toContain("idiom");
      expect(prompt).toContain("metaphor");
    });

    it("handles empty item list", () => {
      const prompt = buildFairnessPrompt([]);
      expect(prompt).toContain("fairness");
      expect(typeof prompt).toBe("string");
    });

    it("includes flag value names", () => {
      const prompt = buildFairnessPrompt([
        { id: "test", stem: "Test" },
      ]);
      expect(prompt).toContain("idiom");
      expect(prompt).toContain("metaphor");
      expect(prompt).toContain("sensory_assumption");
      expect(prompt).toContain("protected_class");
      expect(prompt).toContain("jargon");
    });
  });

  // ---------------------------------------------------------------------------
  // Response Parser
  // ---------------------------------------------------------------------------

  describe("parseFairnessResponse", () => {
    it("returns empty results and warning for null input", () => {
      const { results, warnings } = parseFairnessResponse(null, new Set());
      expect(results).toEqual([]);
      expect(warnings.length).toBeGreaterThan(0);
    });

    it("returns empty results and warning for undefined input", () => {
      const { results, warnings } = parseFairnessResponse(undefined, new Set());
      expect(results).toEqual([]);
      expect(warnings.length).toBeGreaterThan(0);
    });

    it("returns empty results and warning for non-string input", () => {
      const { results, warnings } = parseFairnessResponse(123 as unknown as string, new Set());
      expect(results).toEqual([]);
      expect(warnings.length).toBeGreaterThan(0);
    });

    it("handles fenced JSON responses", () => {
      const raw = `\`\`\`json
[
  { "id": "item-1", "flags": [] }
]
\`\`\``;
      const { results } = parseFairnessResponse(raw, new Set(["item-1"]));
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("item-1");
    });

    it("handles bare array responses", () => {
      const raw =
        '[{ "id": "item-1", "flags": [] }, { "id": "item-2", "flags": ["idiom"] }]';
      const { results } = parseFairnessResponse(
        raw,
        new Set(["item-1", "item-2"])
      );
      expect(results.length).toBe(2);
      expect(results[0].id).toBe("item-1");
      expect(results[1].id).toBe("item-2");
      expect(results[1].flags).toContain("idiom");
    });

    it("drops items with unknown IDs and warns", () => {
      const raw =
        '[{ "id": "item-1", "flags": [] }, { "id": "unknown-id", "flags": [] }]';
      const { results, warnings } = parseFairnessResponse(
        raw,
        new Set(["item-1"])
      );
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("item-1");
      expect(warnings.some((w) => w.includes("unknown"))).toBe(true);
    });

    it("drops duplicate IDs and warns", () => {
      const raw =
        '[{ "id": "item-1", "flags": [] }, { "id": "item-1", "flags": ["idiom"] }]';
      const { results, warnings } = parseFairnessResponse(
        raw,
        new Set(["item-1"])
      );
      expect(results.length).toBe(1);
      expect(warnings.some((w) => w.includes("duplicate"))).toBe(true);
    });

    it("drops unknown flag values and warns", () => {
      const raw =
        '[{ "id": "item-1", "flags": ["idiom", "unknown_flag", "metaphor"] }]';
      const { results, warnings } = parseFairnessResponse(
        raw,
        new Set(["item-1"])
      );
      expect(results.length).toBe(1);
      expect(results[0].flags).toContain("idiom");
      expect(results[0].flags).toContain("metaphor");
      expect(results[0].flags).not.toContain("unknown_flag");
      expect(warnings.some((w) => w.includes("unknown flag"))).toBe(true);
    });

    it("includes optional note field", () => {
      const raw =
        '[{ "id": "item-1", "flags": ["idiom"], "note": "Uses colloquial expression." }]';
      const { results } = parseFairnessResponse(raw, new Set(["item-1"]));
      expect(results[0].note).toBe("Uses colloquial expression.");
    });

    it("omits note field if empty", () => {
      const raw = '[{ "id": "item-1", "flags": [] }]';
      const { results } = parseFairnessResponse(raw, new Set(["item-1"]));
      expect(results[0].note).toBeUndefined();
    });

    it("handles invalid JSON gracefully", () => {
      const raw = "not json at all";
      const { results, warnings } = parseFairnessResponse(
        raw,
        new Set(["item-1"])
      );
      expect(results.length).toBe(0);
      expect(warnings.length).toBeGreaterThan(0);
    });

    it("skips malformed items", () => {
      const raw =
        '[{ "id": "item-1", "flags": [] }, null, { "id": "item-2" }]';
      const { results, warnings } = parseFairnessResponse(
        raw,
        new Set(["item-1", "item-2"])
      );
      // item-1 should parse; null and item-2 (missing id) should skip
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(warnings.length).toBeGreaterThan(0);
    });

    it("warns if root is not an array", () => {
      const raw = '{ "results": [] }';
      const { results, warnings } = parseFairnessResponse(raw, new Set());
      expect(results.length).toBe(0);
      expect(warnings.some((w) => w.includes("root"))).toBe(true);
    });

    it("never throws on garbage input", () => {
      expect(() => {
        parseFairnessResponse("!!!", new Set(["item-1"]));
      }).not.toThrow();
      expect(() => {
        parseFairnessResponse("[[[", new Set());
      }).not.toThrow();
      expect(() => {
        parseFairnessResponse("", new Set());
      }).not.toThrow();
    });

    it("handles all valid flag values", () => {
      const raw =
        '[{ "id": "item-1", "flags": ["idiom", "metaphor", "sensory_assumption", "protected_class", "jargon"] }]';
      const { results } = parseFairnessResponse(raw, new Set(["item-1"]));
      expect(results[0].flags.length).toBe(5);
      expect(results[0].flags).toContain("idiom");
      expect(results[0].flags).toContain("metaphor");
      expect(results[0].flags).toContain("sensory_assumption");
      expect(results[0].flags).toContain("protected_class");
      expect(results[0].flags).toContain("jargon");
    });

    it("is case-insensitive for flag values", () => {
      const raw =
        '[{ "id": "item-1", "flags": ["IDIOM", "Metaphor", "SENSORY_ASSUMPTION"] }]';
      const { results } = parseFairnessResponse(raw, new Set(["item-1"]));
      expect(results[0].flags).toContain("idiom");
      expect(results[0].flags).toContain("metaphor");
      expect(results[0].flags).toContain("sensory_assumption");
    });

    it("handles responses with extra whitespace", () => {
      const raw = `
[
  {  "id"  :  "item-1"  ,  "flags"  :  []  }
]
      `;
      const { results } = parseFairnessResponse(raw, new Set(["item-1"]));
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("item-1");
    });

    it("trims ID and note strings", () => {
      const raw =
        '[{ "id": "  item-1  ", "flags": [], "note": "  trimmed  " }]';
      const { results } = parseFairnessResponse(raw, new Set(["item-1"]));
      expect(results[0].id).toBe("item-1");
      expect(results[0].note).toBe("trimmed");
    });
  });

  // ---------------------------------------------------------------------------
  // Reading Grade Ceiling Constants
  // ---------------------------------------------------------------------------

  describe("READING_GRADE_CEILING_BY_AUDIENCE", () => {
    it("contains expected audience levels", () => {
      expect(READING_GRADE_CEILING_BY_AUDIENCE).toHaveProperty("entry");
      expect(READING_GRADE_CEILING_BY_AUDIENCE).toHaveProperty("mid");
      expect(READING_GRADE_CEILING_BY_AUDIENCE).toHaveProperty("senior");
      expect(READING_GRADE_CEILING_BY_AUDIENCE).toHaveProperty("executive");
      expect(READING_GRADE_CEILING_BY_AUDIENCE).toHaveProperty("mixed");
    });

    it("assigns reasonable ceiling values", () => {
      expect(READING_GRADE_CEILING_BY_AUDIENCE.entry).toBeLessThan(
        READING_GRADE_CEILING_BY_AUDIENCE.mid
      );
      expect(READING_GRADE_CEILING_BY_AUDIENCE.mid).toBeLessThan(
        READING_GRADE_CEILING_BY_AUDIENCE.senior
      );
      expect(READING_GRADE_CEILING_BY_AUDIENCE.senior).toBeLessThan(
        READING_GRADE_CEILING_BY_AUDIENCE.executive
      );
    });
  });
});
