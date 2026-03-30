/**
 * wto.ts — Weighted Topological Overlap (wTO) redundancy detection
 *
 * wTO(i,j) = (Σ_u A[i][u]·A[j][u] + A[i][j]) / (min(Σ_u A[i][u], Σ_u A[j][u]) + 1 - A[i][j])
 *
 * Items with max wTO > cutoff are flagged as redundant.
 * Iterative removal: in each redundant pair, remove the item with higher overall wTO.
 */
import type { AdjacencyMatrix, RedundancyResult } from '@/types/generation'

export function computeWTO(adj: AdjacencyMatrix): number[][] {
  const n = adj.length
  const wto: number[][] = Array.from({ length: n }, () => new Array(n).fill(0) as number[])
  const degrees = adj.map(row => row.reduce((s, v) => s + v, 0))

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let sharedNeighbors = 0
      for (let u = 0; u < n; u++) {
        sharedNeighbors += adj[i][u] * adj[j][u]
      }
      const numerator   = sharedNeighbors + adj[i][j]
      const denominator = Math.min(degrees[i], degrees[j]) + 1 - adj[i][j]
      const score = denominator > 0 ? numerator / denominator : 0
      wto[i][j] = wto[j][i] = score
    }
  }
  return wto
}

export function findRedundantItems(
  adj: AdjacencyMatrix,
  cutoff: number,
): RedundancyResult {
  const n = adj.length
  const wtoMatrix = computeWTO(adj)

  // Per-item max wTO (excluding self)
  const wtoScores = Array.from({ length: n }, (_, i) =>
    Math.max(...wtoMatrix[i].filter((_, j) => j !== i), 0)
  )

  const redundantIndices = new Set<number>()

  // Iteratively flag redundant items
  // In each redundant pair (wTO > cutoff), flag the one with higher max wTO
  let changed = true
  while (changed) {
    changed = false
    for (let i = 0; i < n; i++) {
      if (redundantIndices.has(i)) continue
      for (let j = i + 1; j < n; j++) {
        if (redundantIndices.has(j)) continue
        if (wtoMatrix[i][j] > cutoff) {
          // Remove the item with higher overall wTO
          const toRemove = wtoScores[i] >= wtoScores[j] ? i : j
          redundantIndices.add(toRemove)
          changed = true
        }
      }
    }
  }

  return { redundantIndices, wtoScores }
}
