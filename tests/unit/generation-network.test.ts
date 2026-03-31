import { afterEach, describe, expect, it, vi } from "vitest"
import { itemCorrelationMatrix } from "@/lib/ai/generation/network/correlation"
import { findRedundantItemsIterative } from "@/lib/ai/generation/network/wto"
import { alignCommunitiesToReference } from "@/lib/ai/generation/network/bootstrap"

describe("generation network math", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock("@/lib/ai/generation/network/correlation")
    vi.doUnmock("@/lib/ai/generation/network/network-builder")
    vi.doUnmock("@/lib/ai/generation/network/walktrap")
  })

  it("computes item correlations across embedding dimensions", () => {
    const matrix = itemCorrelationMatrix([
      [1, 2, 3, 4],
      [2, 4, 6, 8],
      [4, 3, 2, 1],
    ])

    expect(matrix[0]?.[0]).toBe(1)
    expect(matrix[1]?.[1]).toBe(1)
    expect(matrix[2]?.[2]).toBe(1)
    expect(matrix[0]?.[1]).toBeCloseTo(1, 6)
    expect(matrix[1]?.[0]).toBeCloseTo(1, 6)
    expect(matrix[0]?.[2]).toBeCloseTo(-1, 6)
    expect(matrix[2]?.[0]).toBeCloseTo(-1, 6)
  })

  it("aligns bootstrap community labels back to the original reference labels", () => {
    expect(
      alignCommunitiesToReference([10, 10, 20, 20], [1, 1, 2, 2]),
    ).toEqual([1, 1, 2, 2])
  })

  it("removes globally redundant items and records the sweep", () => {
    const embeddings = [
      [1, 2, 3, 4, 5, 6],
      [1.1, 2.1, 3.1, 4.1, 5.1, 6.1],
      [1, -1, 1, -1, 1, -1],
    ]

    const result = findRedundantItemsIterative(
      embeddings,
      0.2,
      (corrMatrix) =>
        corrMatrix.map((row, i) =>
          row.map((value, j) => (i === j ? 0 : Math.abs(value) > 0.95 ? value : 0)),
        ),
    )

    expect(result.redundantIndices.size).toBe(1)
    expect(result.redundantIndices.has(1)).toBe(true)
    expect(result.removalSweepByIndex?.get(1)).toBe(1)
    expect(result.sweepCount).toBeGreaterThanOrEqual(1)
    expect(result.wtoScores[0]).toBeGreaterThan(0.9)
    expect(result.wtoScores[1]).toBeGreaterThan(0.9)
  })

  it("scores bootstrap stability against aligned communities instead of raw labels", async () => {
    vi.doMock("@/lib/ai/generation/network/correlation", () => ({
      itemCorrelationMatrix: vi.fn(() => [
        [1, 0.9, 0.1, 0.1],
        [0.9, 1, 0.1, 0.1],
        [0.1, 0.1, 1, 0.8],
        [0.1, 0.1, 0.8, 1],
      ]),
      resampleEmbeddingDimensions: vi.fn((embeddings: number[][]) => embeddings),
    }))

    vi.doMock("@/lib/ai/generation/network/network-builder", () => ({
      buildNetwork: vi.fn(() => ({
        adjacency: [
          [0, 1, 0, 0],
          [1, 0, 0, 0],
          [0, 0, 0, 1],
          [0, 0, 1, 0],
        ],
        threshold: 0.8,
        edgeCount: 2,
        estimator: "tmfg",
      })),
    }))

    vi.doMock("@/lib/ai/generation/network/walktrap", () => ({
      walktrap: vi.fn(() => [
        { itemIndex: 0, communityId: 10, stability: 0 },
        { itemIndex: 1, communityId: 10, stability: 0 },
        { itemIndex: 2, communityId: 20, stability: 0 },
        { itemIndex: 3, communityId: 20, stability: 0 },
      ]),
    }))

    const { bootstrapStability } = await import("@/lib/ai/generation/network/bootstrap")

    const result = bootstrapStability(
      [[1], [2], [3], [4]],
      [1, 1, 2, 2],
      "tmfg",
      4,
      5,
      0.75,
    )

    expect(result.stabilityScores).toEqual([1, 1, 1, 1])
    expect(result.unstableIndices.size).toBe(0)
  })
})
