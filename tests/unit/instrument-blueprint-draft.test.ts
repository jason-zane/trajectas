import { describe, it, expect } from "vitest";

import {
  DEFAULT_BLUEPRINT_SYSTEM_PROMPT,
  buildBlueprintDraftPrompt,
  parseBlueprintDraft,
  draftToCells,
  type BlueprintDraftInput,
  type BlueprintDraftResult,
} from "@/lib/instrument/blueprint-draft";

// ---------------------------------------------------------------------------
// System Prompt Tests
// ---------------------------------------------------------------------------

describe("DEFAULT_BLUEPRINT_SYSTEM_PROMPT", () => {
  it("should contain the prompt text", () => {
    expect(DEFAULT_BLUEPRINT_SYSTEM_PROMPT).toContain("psychometrician");
    expect(DEFAULT_BLUEPRINT_SYSTEM_PROMPT).toContain("table of specifications");
    expect(DEFAULT_BLUEPRINT_SYSTEM_PROMPT).toContain("mutually exclusive");
    expect(DEFAULT_BLUEPRINT_SYSTEM_PROMPT).toContain("attenuation paradox");
  });

  it("should instruct the model to return JSON", () => {
    expect(DEFAULT_BLUEPRINT_SYSTEM_PROMPT).toContain("```json");
    expect(DEFAULT_BLUEPRINT_SYSTEM_PROMPT).toContain("facets");
    expect(DEFAULT_BLUEPRINT_SYSTEM_PROMPT).toContain("exclusions");
  });

  it("should emphasise breadth over tidiness", () => {
    expect(DEFAULT_BLUEPRINT_SYSTEM_PROMPT).toContain("Breadth matters");
  });

  it("should mention intensity levels", () => {
    expect(DEFAULT_BLUEPRINT_SYSTEM_PROMPT).toContain("low");
    expect(DEFAULT_BLUEPRINT_SYSTEM_PROMPT).toContain("mid");
    expect(DEFAULT_BLUEPRINT_SYSTEM_PROMPT).toContain("high");
  });
});

// ---------------------------------------------------------------------------
// Prompt Builder Tests
// ---------------------------------------------------------------------------

describe("buildBlueprintDraftPrompt", () => {
  it("should include construct name", () => {
    const input: BlueprintDraftInput = {
      constructName: "Leadership",
      measureType: "competency_behavioural",
      targetItemCount: 30,
    };
    const prompt = buildBlueprintDraftPrompt(input);
    expect(prompt).toContain("Construct Name: Leadership");
  });

  it("should include construct definition if provided", () => {
    const input: BlueprintDraftInput = {
      constructName: "Leadership",
      constructDefinition: "The ability to guide and influence others.",
      measureType: "competency_behavioural",
      targetItemCount: 30,
    };
    const prompt = buildBlueprintDraftPrompt(input);
    expect(prompt).toContain("Definition: The ability to guide and influence others.");
  });

  it("should omit definition if not provided", () => {
    const input: BlueprintDraftInput = {
      constructName: "Leadership",
      measureType: "competency_behavioural",
      targetItemCount: 30,
    };
    const prompt = buildBlueprintDraftPrompt(input);
    expect(prompt).not.toContain("Definition:");
  });

  it("should include construct description if provided", () => {
    const input: BlueprintDraftInput = {
      constructName: "Leadership",
      constructDescription: "For senior managers.",
      measureType: "competency_behavioural",
      targetItemCount: 30,
    };
    const prompt = buildBlueprintDraftPrompt(input);
    expect(prompt).toContain("Description: For senior managers.");
  });

  it("should include low-intensity indicators", () => {
    const input: BlueprintDraftInput = {
      constructName: "Leadership",
      indicatorsLow: ["Shows patience", "Listens to others"],
      measureType: "competency_behavioural",
      targetItemCount: 30,
    };
    const prompt = buildBlueprintDraftPrompt(input);
    expect(prompt).toContain("Low-intensity indicators:");
    expect(prompt).toContain("Shows patience");
    expect(prompt).toContain("Listens to others");
  });

  it("should include mid-intensity indicators", () => {
    const input: BlueprintDraftInput = {
      constructName: "Leadership",
      indicatorsMid: ["Motivates teams", "Makes decisions"],
      measureType: "competency_behavioural",
      targetItemCount: 30,
    };
    const prompt = buildBlueprintDraftPrompt(input);
    expect(prompt).toContain("Mid-intensity indicators:");
    expect(prompt).toContain("Motivates teams");
  });

  it("should include high-intensity indicators", () => {
    const input: BlueprintDraftInput = {
      constructName: "Leadership",
      indicatorsHigh: ["Drives strategic change", "Influences executives"],
      measureType: "competency_behavioural",
      targetItemCount: 30,
    };
    const prompt = buildBlueprintDraftPrompt(input);
    expect(prompt).toContain("High-intensity indicators:");
    expect(prompt).toContain("Drives strategic change");
  });

  it("should include measure-type guidance", () => {
    const input: BlueprintDraftInput = {
      constructName: "Leadership",
      measureType: "trait",
      targetItemCount: 30,
    };
    const prompt = buildBlueprintDraftPrompt(input);
    expect(prompt).toContain("Measure type: trait.");
    expect(prompt).toContain("personality or dispositional trait");
  });

  it("should include competency_behavioural guidance", () => {
    const input: BlueprintDraftInput = {
      constructName: "Teamwork",
      measureType: "competency_behavioural",
      targetItemCount: 30,
    };
    const prompt = buildBlueprintDraftPrompt(input);
    expect(prompt).toContain("workplace competency");
  });

  it("should include sjt guidance", () => {
    const input: BlueprintDraftInput = {
      constructName: "Judgment",
      measureType: "sjt",
      targetItemCount: 30,
    };
    const prompt = buildBlueprintDraftPrompt(input);
    expect(prompt).toContain("situation judgment test");
  });

  it("should include contrast constructs (DO NOT include)", () => {
    const input: BlueprintDraftInput = {
      constructName: "Leadership",
      contrastConstructs: [
        { name: "Management", definition: "Organizing tasks and resources" },
        { name: "Dominance" },
      ],
      measureType: "competency_behavioural",
      targetItemCount: 30,
    };
    const prompt = buildBlueprintDraftPrompt(input);
    expect(prompt).toContain("Contrast constructs (DO NOT include these in your blueprint)");
    expect(prompt).toContain("Management");
    expect(prompt).toContain("Organizing tasks and resources");
    expect(prompt).toContain("Dominance");
  });

  it("should include target item count", () => {
    const input: BlueprintDraftInput = {
      constructName: "Leadership",
      measureType: "competency_behavioural",
      targetItemCount: 42,
    };
    const prompt = buildBlueprintDraftPrompt(input);
    expect(prompt).toContain("Target total item count: 42");
  });

  it("should include audience level if provided", () => {
    const input: BlueprintDraftInput = {
      constructName: "Leadership",
      audienceLevel: "Senior managers",
      measureType: "competency_behavioural",
      targetItemCount: 30,
    };
    const prompt = buildBlueprintDraftPrompt(input);
    expect(prompt).toContain("Audience level: Senior managers");
  });

  it("should include use context if provided", () => {
    const input: BlueprintDraftInput = {
      constructName: "Leadership",
      useContext: "Internal development program",
      measureType: "competency_behavioural",
      targetItemCount: 30,
    };
    const prompt = buildBlueprintDraftPrompt(input);
    expect(prompt).toContain("Use context: Internal development program");
  });

  it("should not include audience/context if not provided", () => {
    const input: BlueprintDraftInput = {
      constructName: "Leadership",
      measureType: "competency_behavioural",
      targetItemCount: 30,
    };
    const prompt = buildBlueprintDraftPrompt(input);
    expect(prompt).not.toContain("Audience level:");
    expect(prompt).not.toContain("Use context:");
  });
});

// ---------------------------------------------------------------------------
// Parser Tests: Valid Inputs
// ---------------------------------------------------------------------------

describe("parseBlueprintDraft — valid inputs", () => {
  it("should parse fenced JSON with markdown code fence", () => {
    const raw = `\`\`\`json
{
  "facets": [
    {
      "facetLabel": "Communication",
      "facetDefinition": "The ability to convey ideas clearly.",
      "cells": [
        { "intensity": "low", "targetItemCount": 2 },
        { "intensity": "mid", "targetItemCount": 3 },
        { "intensity": "high", "targetItemCount": 4 }
      ]
    }
  ],
  "exclusions": ["Rhetoric"]
}
\`\`\``;

    const result = parseBlueprintDraft(raw);
    expect(result.facets).toHaveLength(1);
    expect(result.facets[0].facetLabel).toBe("Communication");
    expect(result.facets[0].cells).toHaveLength(3);
    expect(result.exclusions).toEqual(["Rhetoric"]);
    expect(result.warnings).toEqual([]);
  });

  it("should parse wrapped object (facets/exclusions keys)", () => {
    const raw = JSON.stringify({
      facets: [
        {
          facetLabel: "Strategic Thinking",
          facetDefinition: "Seeing the big picture.",
          cells: [
            { intensity: "low", targetItemCount: 2 },
            { intensity: "mid", targetItemCount: 3 },
          ],
        },
      ],
      exclusions: ["Tactical Execution"],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets).toHaveLength(1);
    expect(result.facets[0].facetLabel).toBe("Strategic Thinking");
    expect(result.exclusions).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });

  it("should parse bare array of facets", () => {
    const raw = JSON.stringify([
      {
        facetLabel: "Initiative",
        facetDefinition: "Taking action without waiting.",
        cells: [{ intensity: "high", targetItemCount: 5 }],
      },
    ]);

    const result = parseBlueprintDraft(raw);
    expect(result.facets).toHaveLength(1);
    expect(result.facets[0].facetLabel).toBe("Initiative");
    expect(result.exclusions).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("should handle multiple facets", () => {
    const raw = JSON.stringify({
      facets: [
        {
          facetLabel: "Listening",
          facetDefinition: "Attentive receptiveness.",
          cells: [{ intensity: "mid", targetItemCount: 3 }],
        },
        {
          facetLabel: "Articulation",
          facetDefinition: "Clear expression.",
          cells: [{ intensity: "high", targetItemCount: 4 }],
        },
      ],
      exclusions: [],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets).toHaveLength(2);
    expect(result.facets[0].facetLabel).toBe("Listening");
    expect(result.facets[1].facetLabel).toBe("Articulation");
  });

  it("should handle multiple exclusions", () => {
    const raw = JSON.stringify({
      facets: [
        {
          facetLabel: "Empathy",
          facetDefinition: "Understanding others' feelings.",
          cells: [{ intensity: "mid", targetItemCount: 3 }],
        },
      ],
      exclusions: ["Sympathy", "Emotional contagion", "Mind reading"],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.exclusions).toHaveLength(3);
    expect(result.warnings).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Parser Tests: Intensity Normalization
// ---------------------------------------------------------------------------

describe("parseBlueprintDraft — intensity normalization", () => {
  it("should normalise 'medium' to 'mid'", () => {
    const raw = JSON.stringify({
      facets: [
        {
          facetLabel: "Example",
          facetDefinition: "Test facet.",
          cells: [{ intensity: "medium", targetItemCount: 3 }],
        },
      ],
      exclusions: [],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets[0].cells[0].intensity).toBe("mid");
    expect(result.warnings).toEqual([]);
  });

  it("should normalise uppercase intensities", () => {
    const raw = JSON.stringify({
      facets: [
        {
          facetLabel: "Example",
          facetDefinition: "Test facet.",
          cells: [
            { intensity: "LOW", targetItemCount: 1 },
            { intensity: "MID", targetItemCount: 2 },
            { intensity: "HIGH", targetItemCount: 3 },
          ],
        },
      ],
      exclusions: [],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets[0].cells[0].intensity).toBe("low");
    expect(result.facets[0].cells[1].intensity).toBe("mid");
    expect(result.facets[0].cells[2].intensity).toBe("high");
  });

  it("should normalise mixed case", () => {
    const raw = JSON.stringify({
      facets: [
        {
          facetLabel: "Example",
          facetDefinition: "Test facet.",
          cells: [
            { intensity: "Low", targetItemCount: 1 },
            { intensity: "Medium", targetItemCount: 2 },
            { intensity: "High", targetItemCount: 3 },
          ],
        },
      ],
      exclusions: [],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets[0].cells[0].intensity).toBe("low");
    expect(result.facets[0].cells[1].intensity).toBe("mid");
    expect(result.facets[0].cells[2].intensity).toBe("high");
  });

  it("should skip cells with unknown intensity and warn", () => {
    const raw = JSON.stringify({
      facets: [
        {
          facetLabel: "Example",
          facetDefinition: "Test facet.",
          cells: [
            { intensity: "low", targetItemCount: 1 },
            { intensity: "unknown", targetItemCount: 2 },
            { intensity: "high", targetItemCount: 3 },
          ],
        },
      ],
      exclusions: [],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets[0].cells).toHaveLength(2);
    expect(result.facets[0].cells[0].intensity).toBe("low");
    expect(result.facets[0].cells[1].intensity).toBe("high");
    expect(result.warnings.some(w => w.includes("unknown intensity"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Parser Tests: Target Count Clamping
// ---------------------------------------------------------------------------

describe("parseBlueprintDraft — target count clamping", () => {
  it("should clamp zero to 1", () => {
    const raw = JSON.stringify({
      facets: [
        {
          facetLabel: "Example",
          facetDefinition: "Test facet.",
          cells: [{ intensity: "mid", targetItemCount: 0 }],
        },
      ],
      exclusions: [],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets[0].cells[0].targetItemCount).toBe(1);
    expect(result.warnings.some(w => w.includes("clamped"))).toBe(true);
  });

  it("should clamp negative to 1", () => {
    const raw = JSON.stringify({
      facets: [
        {
          facetLabel: "Example",
          facetDefinition: "Test facet.",
          cells: [{ intensity: "high", targetItemCount: -5 }],
        },
      ],
      exclusions: [],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets[0].cells[0].targetItemCount).toBe(1);
  });

  it("should accept valid positive counts", () => {
    const raw = JSON.stringify({
      facets: [
        {
          facetLabel: "Example",
          facetDefinition: "Test facet.",
          cells: [{ intensity: "mid", targetItemCount: 10 }],
        },
      ],
      exclusions: [],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets[0].cells[0].targetItemCount).toBe(10);
  });

  it("should clamp float to 1 and warn", () => {
    const raw = JSON.stringify({
      facets: [
        {
          facetLabel: "Example",
          facetDefinition: "Test facet.",
          cells: [{ intensity: "mid", targetItemCount: 2.5 }],
        },
      ],
      exclusions: [],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets[0].cells[0].targetItemCount).toBe(1);
    expect(result.warnings.some(w => w.includes("clamped"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Parser Tests: Duplicate Facet Deduplication
// ---------------------------------------------------------------------------

describe("parseBlueprintDraft — duplicate facet deduplication", () => {
  it("should dedupe facet labels (case-insensitive)", () => {
    const raw = JSON.stringify({
      facets: [
        {
          facetLabel: "Communication",
          facetDefinition: "Verbal expression.",
          cells: [{ intensity: "low", targetItemCount: 2 }],
        },
        {
          facetLabel: "COMMUNICATION",
          facetDefinition: "Another try at communication.",
          cells: [{ intensity: "high", targetItemCount: 3 }],
        },
      ],
      exclusions: [],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets).toHaveLength(1);
    expect(result.warnings.some(w => w.includes("Deduped"))).toBe(true);
  });

  it("should dedupe mixed-case labels", () => {
    const raw = JSON.stringify({
      facets: [
        {
          facetLabel: "Strategic Thinking",
          facetDefinition: "Long-term vision.",
          cells: [{ intensity: "mid", targetItemCount: 2 }],
        },
        {
          facetLabel: "strategic thinking",
          facetDefinition: "Another definition.",
          cells: [{ intensity: "high", targetItemCount: 2 }],
        },
      ],
      exclusions: [],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets).toHaveLength(1);
    expect(result.warnings.length > 0).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Parser Tests: Malformed Input Handling
// ---------------------------------------------------------------------------

describe("parseBlueprintDraft — malformed input handling", () => {
  it("should handle non-JSON input gracefully", () => {
    const raw = "This is not JSON at all.";
    const result = parseBlueprintDraft(raw);

    expect(result.facets).toEqual([]);
    expect(result.exclusions).toEqual([]);
    expect(result.warnings.length > 0).toBe(true);
  });

  it("should not throw on empty string", () => {
    const result = parseBlueprintDraft("");
    expect(result.facets).toEqual([]);
    expect(result.warnings.length > 0).toBe(true);
  });

  it("should not throw on garbage input", () => {
    const result = parseBlueprintDraft("!@#$%^&*()");
    expect(result.facets).toEqual([]);
    expect(result.warnings.length > 0).toBe(true);
  });

  it("should skip facet with missing facetLabel", () => {
    const raw = JSON.stringify({
      facets: [
        {
          facetDefinition: "Missing label",
          cells: [{ intensity: "mid", targetItemCount: 2 }],
        },
      ],
      exclusions: [],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets).toHaveLength(0);
    expect(result.warnings.some(w => w.includes("missing or empty facetLabel"))).toBe(true);
  });

  it("should skip facet with missing definition", () => {
    const raw = JSON.stringify({
      facets: [
        {
          facetLabel: "Example",
          cells: [{ intensity: "mid", targetItemCount: 2 }],
        },
      ],
      exclusions: [],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets).toHaveLength(0);
    expect(result.warnings.some(w => w.includes("missing or empty definition"))).toBe(true);
  });

  it("should skip facet with no valid cells", () => {
    const raw = JSON.stringify({
      facets: [
        {
          facetLabel: "Example",
          facetDefinition: "Test",
          cells: [
            { intensity: "invalid", targetItemCount: 2 },
            { intensity: "also_bad", targetItemCount: 3 },
          ],
        },
      ],
      exclusions: [],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets).toHaveLength(0);
    expect(result.warnings.some(w => w.includes("has no valid cells"))).toBe(true);
  });

  it("should skip malformed facet objects", () => {
    const raw = JSON.stringify({
      facets: [
        {
          facetLabel: "Valid",
          facetDefinition: "This is valid",
          cells: [{ intensity: "mid", targetItemCount: 2 }],
        },
        "not an object",
        {
          facetLabel: "Another",
          facetDefinition: "Also valid",
          cells: [{ intensity: "high", targetItemCount: 3 }],
        },
      ],
      exclusions: [],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets).toHaveLength(2);
    expect(result.warnings.some(w => w.includes("not an object"))).toBe(true);
  });

  it("should skip malformed cells", () => {
    const raw = JSON.stringify({
      facets: [
        {
          facetLabel: "Example",
          facetDefinition: "Test",
          cells: [
            { intensity: "low", targetItemCount: 2 },
            "not a cell",
            { intensity: "high", targetItemCount: 3 },
          ],
        },
      ],
      exclusions: [],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets[0].cells).toHaveLength(2);
    expect(result.warnings.some(w => w.includes("malformed cell"))).toBe(true);
  });

  it("should handle null values gracefully", () => {
    const raw = JSON.stringify({
      facets: [
        {
          facetLabel: "Example",
          facetDefinition: "Test",
          cells: [null, { intensity: "mid", targetItemCount: 2 }],
        },
      ],
      exclusions: [],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets[0].cells).toHaveLength(1);
  });

  it("should handle missing facets key", () => {
    const raw = JSON.stringify({
      exclusions: ["Something"],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets).toEqual([]);
    expect(result.exclusions).toEqual(["Something"]);
  });

  it("should handle missing exclusions key", () => {
    const raw = JSON.stringify({
      facets: [
        {
          facetLabel: "Example",
          facetDefinition: "Test",
          cells: [{ intensity: "mid", targetItemCount: 2 }],
        },
      ],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.exclusions).toEqual([]);
    expect(result.facets).toHaveLength(1);
  });

  it("should handle bare JSON object without facets/exclusions", () => {
    const raw = JSON.stringify({
      someOtherKey: "someValue",
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets).toEqual([]);
    expect(result.exclusions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Parser Tests: Alternative Field Names
// ---------------------------------------------------------------------------

describe("parseBlueprintDraft — alternative field names", () => {
  it("should accept 'label' as alternative to 'facetLabel'", () => {
    const raw = JSON.stringify({
      facets: [
        {
          label: "Alternative Label",
          facetDefinition: "Test definition.",
          cells: [{ intensity: "mid", targetItemCount: 2 }],
        },
      ],
      exclusions: [],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets[0].facetLabel).toBe("Alternative Label");
  });

  it("should accept 'definition' as alternative to 'facetDefinition'", () => {
    const raw = JSON.stringify({
      facets: [
        {
          facetLabel: "Test",
          definition: "Alternative definition.",
          cells: [{ intensity: "mid", targetItemCount: 2 }],
        },
      ],
      exclusions: [],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets[0].facetDefinition).toBe("Alternative definition.");
  });

  it("should accept alternative target count fields", () => {
    const raw = JSON.stringify({
      facets: [
        {
          facetLabel: "Test",
          facetDefinition: "Definition.",
          cells: [
            { intensity: "low", target: 2 },
            { intensity: "mid", count: 3 },
          ],
        },
      ],
      exclusions: [],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets[0].cells[0].targetItemCount).toBe(2);
    expect(result.facets[0].cells[1].targetItemCount).toBe(3);
  });

  it("should prefer specific field names over alternatives", () => {
    const raw = JSON.stringify({
      facets: [
        {
          facetLabel: "Preferred",
          label: "NotUsed",
          facetDefinition: "Preferred def",
          definition: "Not used",
          cells: [{ intensity: "mid", targetItemCount: 2, target: 99 }],
        },
      ],
      exclusions: [],
    });

    const result = parseBlueprintDraft(raw);
    expect(result.facets[0].facetLabel).toBe("Preferred");
    expect(result.facets[0].facetDefinition).toBe("Preferred def");
    expect(result.facets[0].cells[0].targetItemCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Draft-to-Cells Tests
// ---------------------------------------------------------------------------

describe("draftToCells", () => {
  it("should convert facets to cells with sequential displayOrder", () => {
    const draft: BlueprintDraftResult = {
      facets: [
        {
          facetLabel: "Communication",
          facetDefinition: "Test",
          cells: [
            { intensity: "low", targetItemCount: 2 },
            { intensity: "mid", targetItemCount: 3 },
          ],
        },
        {
          facetLabel: "Leadership",
          facetDefinition: "Test",
          cells: [{ intensity: "high", targetItemCount: 4 }],
        },
      ],
      exclusions: [],
      warnings: [],
    };

    const cells = draftToCells(draft, "bp-123");
    expect(cells).toHaveLength(3);
    expect(cells[0].displayOrder).toBe(0);
    expect(cells[1].displayOrder).toBe(1);
    expect(cells[2].displayOrder).toBe(2);
  });

  it("should preserve facet labels and intensities", () => {
    const draft: BlueprintDraftResult = {
      facets: [
        {
          facetLabel: "TestFacet",
          facetDefinition: "Test",
          cells: [{ intensity: "high", targetItemCount: 5 }],
        },
      ],
      exclusions: [],
      warnings: [],
    };

    const cells = draftToCells(draft, "bp-456");
    expect(cells[0].facetLabel).toBe("TestFacet");
    expect(cells[0].intensity).toBe("high");
    expect(cells[0].targetItemCount).toBe(5);
  });

  it("should generate unique cell IDs based on blueprint ID and order", () => {
    const draft: BlueprintDraftResult = {
      facets: [
        {
          facetLabel: "A",
          facetDefinition: "Test",
          cells: [
            { intensity: "low", targetItemCount: 1 },
            { intensity: "high", targetItemCount: 2 },
          ],
        },
      ],
      exclusions: [],
      warnings: [],
    };

    const cells = draftToCells(draft, "my-blueprint");
    expect(cells[0].id).toBe("my-blueprint-0");
    expect(cells[1].id).toBe("my-blueprint-1");
  });

  it("should handle empty draft", () => {
    const draft: BlueprintDraftResult = {
      facets: [],
      exclusions: [],
      warnings: [],
    };

    const cells = draftToCells(draft, "bp-empty");
    expect(cells).toEqual([]);
  });

  it("should handle facet with multiple intensity levels", () => {
    const draft: BlueprintDraftResult = {
      facets: [
        {
          facetLabel: "MultiLevel",
          facetDefinition: "Test",
          cells: [
            { intensity: "low", targetItemCount: 1 },
            { intensity: "mid", targetItemCount: 2 },
            { intensity: "high", targetItemCount: 3 },
          ],
        },
      ],
      exclusions: [],
      warnings: [],
    };

    const cells = draftToCells(draft, "bp-multi");
    expect(cells).toHaveLength(3);
    expect(cells[0].intensity).toBe("low");
    expect(cells[1].intensity).toBe("mid");
    expect(cells[2].intensity).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// Round-trip Tests
// ---------------------------------------------------------------------------

describe("build + parse round-trip", () => {
  it("should handle a realistic end-to-end scenario", () => {
    const input: BlueprintDraftInput = {
      constructName: "Strategic Leadership",
      constructDefinition: "The ability to think long-term and align organisations.",
      indicatorsMid: ["Sets direction", "Aligns teams"],
      indicatorsHigh: ["Drives transformation", "Influences peers"],
      measureType: "competency_behavioural",
      targetItemCount: 24,
      contrastConstructs: [{ name: "Tactical Execution" }],
    };

    const prompt = buildBlueprintDraftPrompt(input);
    expect(prompt).toContain("Strategic Leadership");
    expect(prompt).toContain("24");
    expect(prompt).toContain("Tactical Execution");

    const mockResponse = JSON.stringify({
      facets: [
        {
          facetLabel: "Vision Setting",
          facetDefinition: "Articulating a compelling future state.",
          cells: [
            { intensity: "low", targetItemCount: 2 },
            { intensity: "mid", targetItemCount: 3 },
            { intensity: "high", targetItemCount: 4 },
          ],
        },
        {
          facetLabel: "Organisational Alignment",
          facetDefinition: "Ensuring teams understand and support strategic direction.",
          cells: [
            { intensity: "low", targetItemCount: 2 },
            { intensity: "mid", targetItemCount: 3 },
            { intensity: "high", targetItemCount: 3 },
          ],
        },
      ],
      exclusions: ["Execution details", "Tactical planning"],
    });

    const result = parseBlueprintDraft(mockResponse);
    expect(result.facets).toHaveLength(2);
    expect(result.exclusions).toHaveLength(2);
    expect(result.warnings).toEqual([]);

    const cells = draftToCells(result, "bp-final");
    expect(cells).toHaveLength(6);
    expect(cells[0].facetLabel).toBe("Vision Setting");
    expect(cells[5].facetLabel).toBe("Organisational Alignment");
  });
});
