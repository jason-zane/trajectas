import { describe, expect, it } from "vitest"
import { applyItemOrdering } from "@/lib/item-ordering"

type TestItem = { id: string; construct_id: string | null }

const items: TestItem[] = [
  { id: "a1", construct_id: "A" },
  { id: "a2", construct_id: "A" },
  { id: "a3", construct_id: "A" },
  { id: "b1", construct_id: "B" },
  { id: "b2", construct_id: "B" },
  { id: "b3", construct_id: "B" },
  { id: "c1", construct_id: "C" },
  { id: "c2", construct_id: "C" },
  { id: "c3", construct_id: "C" },
]

describe("applyItemOrdering", () => {
  it("fixed mode returns items unchanged", () => {
    const out = applyItemOrdering(items, "fixed", "session-1")
    expect(out.map((i) => i.id)).toEqual(items.map((i) => i.id))
  })

  it("randomised mode shuffles items", () => {
    const out = applyItemOrdering(items, "randomised", "session-1")
    expect(out.map((i) => i.id)).not.toEqual(items.map((i) => i.id))
    expect(out.map((i) => i.id).sort()).toEqual(items.map((i) => i.id).sort())
  })

  it("randomised mode is deterministic by seed", () => {
    const a = applyItemOrdering(items, "randomised", "session-1")
    const b = applyItemOrdering(items, "randomised", "session-1")
    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id))
  })

  it("randomised mode varies by seed", () => {
    const a = applyItemOrdering(items, "randomised", "session-1")
    const b = applyItemOrdering(items, "randomised", "session-2")
    expect(a.map((i) => i.id)).not.toEqual(b.map((i) => i.id))
  })

  it("interleaved_by_construct never places two consecutive items from the same construct when constructs are balanced", () => {
    const out = applyItemOrdering(items, "interleaved_by_construct", "session-1")
    for (let i = 1; i < out.length; i++) {
      expect(out[i].construct_id).not.toBe(out[i - 1].construct_id)
    }
  })

  it("interleaved_by_construct preserves all items", () => {
    const out = applyItemOrdering(items, "interleaved_by_construct", "session-x")
    expect(out.map((i) => i.id).sort()).toEqual(items.map((i) => i.id).sort())
  })

  it("handles empty and single-item inputs", () => {
    expect(applyItemOrdering([], "randomised", "s")).toEqual([])
    const single: TestItem[] = [{ id: "x", construct_id: null }]
    expect(applyItemOrdering(single, "randomised", "s")).toEqual(single)
  })

  it("defaults to randomised for unknown ordering", () => {
    const a = applyItemOrdering(items, "randomised", "s")
    const b = applyItemOrdering(items, "garbage" as never, "s")
    expect(b.map((i) => i.id)).toEqual(a.map((i) => i.id))
  })
})
