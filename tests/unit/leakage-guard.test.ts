import { describe, expect, it } from "vitest"
import { ConstructCentroidCache, checkItemLeakage } from "@/lib/ai/generation/leakage-guard"

describe("ConstructCentroidCache", () => {
  it("seeds centroids from definitions", () => {
    const cache = new ConstructCentroidCache()
    cache.seed("c1", [1, 0, 0])
    cache.seed("c2", [0, 1, 0])

    expect(cache.getCentroid("c1")).toEqual([1, 0, 0])
    expect(cache.getCentroid("c2")).toEqual([0, 1, 0])
  })

  it("updates centroid incrementally", () => {
    const cache = new ConstructCentroidCache()
    cache.seed("c1", [1, 0, 0])
    cache.addItem("c1", [0, 1, 0])

    const centroid = cache.getCentroid("c1")!
    expect(centroid[0]).toBeCloseTo(0.5)
    expect(centroid[1]).toBeCloseTo(0.5)
    expect(centroid[2]).toBeCloseTo(0)
  })

  it("returns all construct IDs", () => {
    const cache = new ConstructCentroidCache()
    cache.seed("c1", [1, 0])
    cache.seed("c2", [0, 1])

    expect(cache.getConstructIds()).toEqual(["c1", "c2"])
  })

  it("returns undefined for unknown construct", () => {
    const cache = new ConstructCentroidCache()
    expect(cache.getCentroid("unknown")).toBeUndefined()
  })

  it("ignores addItem for unseeded construct", () => {
    const cache = new ConstructCentroidCache()
    cache.addItem("unknown", [1, 0, 0])
    expect(cache.getCentroid("unknown")).toBeUndefined()
  })
})

describe("checkItemLeakage", () => {
  it("returns no leakage when item is closest to its own construct", () => {
    const cache = new ConstructCentroidCache()
    cache.seed("c1", [1, 0, 0])
    cache.seed("c2", [0, 1, 0])
    cache.seed("c3", [0, 0, 1])

    const result = checkItemLeakage([0.9, 0.1, 0], "c1", cache)
    expect(result.isLeaking).toBe(false)
  })

  it("detects leakage when item is closer to another construct", () => {
    const cache = new ConstructCentroidCache()
    cache.seed("c1", [1, 0, 0])
    cache.seed("c2", [0, 1, 0])

    const result = checkItemLeakage([0.1, 0.9, 0], "c1", cache)
    expect(result.isLeaking).toBe(true)
    expect(result.leakageTarget).toBe("c2")
    // Cosine similarity of [0.1, 0.9, 0] to [0, 1, 0] ≈ 0.994
    expect(result.leakageScore).toBeGreaterThan(0.99)
  })

  it("returns no leakage when only one construct exists", () => {
    const cache = new ConstructCentroidCache()
    cache.seed("c1", [1, 0, 0])

    const result = checkItemLeakage([0.5, 0.5, 0], "c1", cache)
    expect(result.isLeaking).toBe(false)
  })

  it("returns no leakage when target construct is not in cache", () => {
    const cache = new ConstructCentroidCache()
    cache.seed("c1", [1, 0, 0])

    const result = checkItemLeakage([0.5, 0.5, 0], "unknown", cache)
    expect(result.isLeaking).toBe(false)
    expect(result.leakageScore).toBe(0)
  })
})
