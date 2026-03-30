/**
 * bootstrap.ts — bootEGA: bootstrap stability analysis
 *
 * Resamples the embedding matrix 100 times (with replacement), runs EGA
 * on each sample, and computes per-item stability as the proportion of
 * bootstrap iterations where the item stayed in its modal community.
 *
 * Items with stability < cutoff are flagged as unstable.
 */
import { cosineSimilarityMatrix } from './correlation'
import { buildNetwork }           from './network-builder'
import { walktrap }               from './walktrap'
import type { StabilityResult }   from '@/types/generation'

export function bootstrapStability(
  embeddings:       number[][],
  constructLabels:  number[],
  nBootstraps:      number,
  stabilityCutoff:  number,
): StabilityResult {
  const n = embeddings.length
  if (n === 0) return { stabilityScores: [], unstableIndices: new Set() }

  // Track community assignments per bootstrap iteration per item
  const communityHistory: number[][] = Array.from({ length: n }, () => [])

  for (let b = 0; b < nBootstraps; b++) {
    // Resample with replacement
    const sampleIndices      = Array.from({ length: n }, () => Math.floor(Math.random() * n))
    const sampleEmbeddings   = sampleIndices.map(i => embeddings[i])
    const sampleLabels       = sampleIndices.map(i => constructLabels[i])

    try {
      const corrMatrix    = cosineSimilarityMatrix(sampleEmbeddings)
      const { adjacency } = buildNetwork(corrMatrix)
      const communities   = walktrap(adjacency, sampleLabels)

      // Map bootstrap assignments back to original item indices
      for (let si = 0; si < sampleIndices.length; si++) {
        const originalIdx = sampleIndices[si]
        communityHistory[originalIdx].push(communities[si]?.communityId ?? 0)
      }
    } catch {
      // Skip failed iterations
    }
  }

  // Compute stability as proportion in modal community
  const stabilityScores = communityHistory.map(history => {
    if (history.length === 0) return 0
    const counts = new Map<number, number>()
    for (const c of history) counts.set(c, (counts.get(c) ?? 0) + 1)
    const modalCount = Math.max(...counts.values())
    return modalCount / history.length
  })

  const unstableIndices = new Set(
    stabilityScores
      .map((s, i) => s < stabilityCutoff ? i : -1)
      .filter(i => i !== -1)
  )

  return { stabilityScores, unstableIndices }
}
