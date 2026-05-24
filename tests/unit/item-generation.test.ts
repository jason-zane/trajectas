import { describe, expect, it } from "vitest"
import { buildItemGenerationPrompt } from "@/lib/ai/generation/prompts/item-generation"
import { buildCritiquePrompt } from "@/lib/ai/generation/prompts/item-critique"

const baseConstruct = {
  id: "1",
  name: "Resilience",
  slug: "resilience",
  definition: "Ability to recover from setbacks",
  existingItemCount: 0,
}

describe("buildItemGenerationPrompt facet diversity", () => {
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

describe("buildItemGenerationPrompt steering blocks", () => {
  it("omits all steering when no steering fields are provided", () => {
    const prompt = buildItemGenerationPrompt({
      construct: baseConstruct,
      batchSize: 20,
      responseFormatDescription: "5-point Likert",
      previousItems: [],
    })
    expect(prompt).not.toContain("## Measurement Mode")
    expect(prompt).not.toContain("## Audience")
    expect(prompt).not.toContain("## Use Context")
    expect(prompt).not.toContain("## Writing Playbook")
  })

  it("includes the behavioural mode block when measurementMode is behavioural", () => {
    const prompt = buildItemGenerationPrompt({
      construct: baseConstruct,
      batchSize: 20,
      responseFormatDescription: "5-point Likert",
      previousItems: [],
      measurementMode: "behavioural",
    })
    expect(prompt).toContain("## Measurement Mode")
    expect(prompt).toContain("Behavioural")
  })

  it("branches to capability guidance when measurementMode is capability", () => {
    const prompt = buildItemGenerationPrompt({
      construct: baseConstruct,
      batchSize: 20,
      responseFormatDescription: "Accuracy scale",
      previousItems: [],
      measurementMode: "capability",
    })
    expect(prompt).toContain("Capability")
    expect(prompt).toContain("can perform")
    // It should NOT include the behavioural-mode wording for capability mode.
    expect(prompt).not.toContain("Behavioural.**")
  })

  it("branches to situational guidance when measurementMode is situational", () => {
    const prompt = buildItemGenerationPrompt({
      construct: baseConstruct,
      batchSize: 20,
      responseFormatDescription: "SJT best-response",
      previousItems: [],
      measurementMode: "situational",
    })
    expect(prompt).toContain("Situational")
    expect(prompt).toContain("scenario")
  })

  it("includes the custom measurementMode description when mode is open", () => {
    const prompt = buildItemGenerationPrompt({
      construct: baseConstruct,
      batchSize: 20,
      responseFormatDescription: "5-point Likert",
      previousItems: [],
      measurementMode: "open",
      measurementModeDescription: "Items should be phrased as proverbs that test wisdom.",
    })
    expect(prompt).toContain("## Measurement Mode (custom)")
    expect(prompt).toContain("phrased as proverbs")
  })

  it("renders audience block with structured level + free description", () => {
    const prompt = buildItemGenerationPrompt({
      construct: baseConstruct,
      batchSize: 20,
      responseFormatDescription: "5-point Likert",
      previousItems: [],
      audience: { level: "entry", description: "graduate intake cohort" },
    })
    expect(prompt).toContain("## Audience")
    expect(prompt).toContain("entry-level")
    expect(prompt).toContain("graduate intake cohort")
  })

  it("renders selection use-context with SD posture cue", () => {
    const prompt = buildItemGenerationPrompt({
      construct: baseConstruct,
      batchSize: 20,
      responseFormatDescription: "5-point Likert",
      previousItems: [],
      useContext: "selection",
    })
    expect(prompt).toContain("## Use Context")
    expect(prompt).toContain("Selection")
    expect(prompt).toMatch(/Faking\s+risk/)
  })

  it("injects playbook rubric and exemplars when a playbook is supplied", () => {
    const prompt = buildItemGenerationPrompt({
      construct: baseConstruct,
      batchSize: 20,
      responseFormatDescription: "5-point Likert",
      previousItems: [],
      playbook: {
        rubric:
          "All stems must be present-tense first-person declaratives under 18 words.",
        exemplars: [
          {
            stem: "I recover from setbacks within a day.",
            verdict: "good",
            reason: "concrete, behaviour-anchored, time-bounded",
          },
          {
            stem: "I am extremely resilient.",
            verdict: "bad",
            reason: "abstract self-rating, no behavioural anchor",
          },
        ],
        critiqueStrictness: "strict",
        sdTolerance: "low",
      },
    })
    expect(prompt).toContain("## Writing Playbook")
    expect(prompt).toContain("present-tense first-person declaratives")
    expect(prompt).toContain("### Exemplars")
    expect(prompt).toContain("✓ Good")
    expect(prompt).toContain("✗ Avoid")
    expect(prompt).toContain("Social-desirability tolerance: low")
  })
})

describe("buildCritiquePrompt steering", () => {
  it("includes the construct and items even without steering", () => {
    const prompt = buildCritiquePrompt({
      items: [
        { stem: "I bounce back quickly", reverseScored: false, rationale: "" },
      ],
      constructName: "Resilience",
    })
    expect(prompt).toContain("Target Construct: Resilience")
    expect(prompt).toContain("I bounce back quickly")
  })

  it("includes critique emphasis from playbook when provided", () => {
    const prompt = buildCritiquePrompt({
      items: [
        { stem: "I bounce back quickly", reverseScored: false, rationale: "" },
      ],
      constructName: "Resilience",
      playbook: {
        critiqueEmphasis:
          "Weight social-desirability heavily; selection use-case.",
        critiqueStrictness: "strict",
      },
    })
    expect(prompt).toContain("## Critique Emphasis")
    expect(prompt).toContain("Weight social-desirability heavily")
    expect(prompt).toContain("Critique Strictness: strict")
  })

  it("threads measurement-mode and use-context steering into critique", () => {
    const prompt = buildCritiquePrompt({
      items: [
        { stem: "I bounce back quickly", reverseScored: false, rationale: "" },
      ],
      constructName: "Resilience",
      measurementMode: "behavioural",
      useContext: "development",
    })
    expect(prompt).toContain("Behavioural")
    expect(prompt).toContain("Development")
  })
})
