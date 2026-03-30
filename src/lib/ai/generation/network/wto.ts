/**
 * wto.ts — Weighted Topological Overlap (wTO) redundancy detection
 *
 * wTO(i,j) = (Σ_u A[i][u]·A[j][u] + A[i][j]) / (min(Σ_u A[i][u], Σ_u A[j][u]) + 1 - A[i][j])
 *
 * Items with max wTO > cutoff are flagged as redundant.
 * Iterative removal: in each redundant pair, remove the item with higher overall wTO.
 */
import { cosineSimilarityMatrix, partialCorrelationMatrix } from './correlation'
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

/**
 * Iterative UVA as specified by the AI-GENIE paper:
 * remove redundant items, rebuild the network, recompute wTO, repeat
 * until no pairs exceed the cutoff.
 *
 * Partial correlations are computed ONCE from the full item set to avoid
 * a deflation spiral: recomputing with fewer items inflates remaining
 * partial correlations because fewer variables condition away shared variance.
 */
export function findRedundantItemsIterative(
  embeddings: number[][],
  cutoff: number,
  buildNetworkFn: (corrMatrix: number[][]) => AdjacencyMatrix,
): RedundancyResult {
  const n = embeddings.length
  const wtoScores = new Array<number>(n).fill(0)
  const redundantIndices = new Set<number>()

  // Compute partial correlations ONCE from the full item set.
  // Recomputing per-iteration would cause a deflation spiral: removing items
  // inflates remaining partial correlations, flagging more items, and so on.
  const fullCorrMatrix = cosineSimilarityMatrix(embeddings)
  const fullPcorMatrix = partialCorrelationMatrix(fullCorrMatrix)
  if (!fullPcorMatrix) {
    console.warn('[UVA] Partial correlation inversion failed — falling back to cosine similarities')
  }
  const baseMatrix = fullPcorMatrix ?? fullCorrMatrix

  // Active indices — items still in the running
  let active = Array.from({ length: n }, (_, i) => i)

  for (;;) {
    if (active.length < 2) break

    // Extract sub-matrix for active items from the pre-computed base matrix
    const subMatrix = active.map(i => active.map(j => baseMatrix[i][j]))
    const adj = buildNetworkFn(subMatrix)
    const wto = computeWTO(adj)
    const subN = active.length

    // Find pairs exceeding cutoff and pick items to remove
    const toRemove = new Set<number>() // indices into `active`
    const maxWto = new Array<number>(subN).fill(0)
    for (let i = 0; i < subN; i++) {
      for (let j = i + 1; j < subN; j++) {
        if (wto[i][j] > maxWto[i]) maxWto[i] = wto[i][j]
        if (wto[i][j] > maxWto[j]) maxWto[j] = wto[i][j]
      }
    }

    for (let i = 0; i < subN; i++) {
      if (toRemove.has(i)) continue
      for (let j = i + 1; j < subN; j++) {
        if (toRemove.has(j)) continue
        if (wto[i][j] > cutoff) {
          // Remove the item with higher max-wTO
          const victim = maxWto[i] >= maxWto[j] ? i : j
          toRemove.add(victim)
        }
      }
    }

    if (toRemove.size === 0) {
      // Record final wTO scores for surviving items
      for (let i = 0; i < subN; i++) {
        wtoScores[active[i]] = maxWto[i]
      }
      break
    }

    // Record wTO scores for removed items and mark them redundant
    for (const subIdx of toRemove) {
      const originalIdx = active[subIdx]
      wtoScores[originalIdx] = maxWto[subIdx]
      redundantIndices.add(originalIdx)
    }

    // Shrink active set
    active = active.filter((_, i) => !toRemove.has(i))
  }

  return { redundantIndices, wtoScores }
}
