import { describe, expect, it } from "vitest"
import {
  buildObserverPerspectivePrompt,
  parseObserverVariants,
  OBSERVER_SUBJECT,
} from "@/lib/ai/generation/prompts/observer-perspective"

describe("buildObserverPerspectivePrompt", () => {
  it("lists each item with its id and construct context", () => {
    const prompt = buildObserverPerspectivePrompt([
      { id: "a1", stem: "I communicate clearly", constructName: "Communication" },
      { id: "b2", stem: "I avoid hard decisions" },
    ])
    expect(prompt).toContain("[id: a1]")
    expect(prompt).toContain("(construct: Communication)")
    expect(prompt).toContain("I communicate clearly")
    expect(prompt).toContain("[id: b2]")
    expect(prompt).toContain(OBSERVER_SUBJECT)
  })
})

describe("parseObserverVariants", () => {
  const valid = new Set(["a1", "b2"])

  it("parses a clean JSON array, keeping only known ids", () => {
    const json = JSON.stringify([
      { id: "a1", stemObserver: "This leader communicates clearly" },
      { id: "b2", stemObserver: "This leader avoids hard decisions" },
      { id: "x9", stemObserver: "Unknown id should be dropped" },
    ])
    const out = parseObserverVariants(json, valid)
    expect(out).toHaveLength(2)
    expect(out.find((v) => v.id === "a1")?.stemObserver).toBe(
      "This leader communicates clearly",
    )
    expect(out.some((v) => v.id === "x9")).toBe(false)
  })

  it("strips markdown code fences", () => {
    const json =
      '```json\n[{"id":"a1","stemObserver":"This leader communicates clearly"}]\n```'
    expect(parseObserverVariants(json, valid)).toHaveLength(1)
  })

  it("unwraps a wrapped array under an object key", () => {
    const json = JSON.stringify({
      items: [{ id: "a1", stemObserver: "This leader communicates clearly" }],
    })
    expect(parseObserverVariants(json, valid)).toHaveLength(1)
  })

  it("drops empty stems and de-dupes repeated ids", () => {
    const json = JSON.stringify([
      { id: "a1", stemObserver: "   " },
      { id: "b2", stemObserver: "This leader avoids hard decisions" },
      { id: "b2", stemObserver: "duplicate" },
    ])
    const out = parseObserverVariants(json, valid)
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe("b2")
  })

  it("returns [] on invalid JSON", () => {
    expect(parseObserverVariants("not json", valid)).toEqual([])
  })
})
