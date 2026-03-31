/**
 * bootstrap.ts — bootEGA stability analysis
 *
 * Bootstraps embedding dimensions (observations), not items, and aligns each
 * bootstrap partition back to the original community structure before scoring
 * item stability.
 */
import { itemCorrelationMatrix, resampleEmbeddingDimensions } from './correlation'
import { buildNetwork } from './network-builder'
import { walktrap } from './walktrap'
import type { NetworkEstimator, StabilityResult } from '@/types/generation'

export function bootstrapStability(
  embeddings: number[][],
  originalCommunities: number[],
  estimator: NetworkEstimator,
  walktrapStep: number,
  nBootstraps: number,
  stabilityCutoff: number,
): StabilityResult {
  const itemCount = embeddings.length
  if (itemCount === 0) return { stabilityScores: [], unstableIndices: new Set() }

  const stableCounts = new Array<number>(itemCount).fill(0)
  let successfulIterations = 0

  for (let iteration = 0; iteration < nBootstraps; iteration++) {
    try {
      const sampledEmbeddings = resampleEmbeddingDimensions(embeddings)
      const corrMatrix = itemCorrelationMatrix(sampledEmbeddings)
      const { adjacency } = buildNetwork(corrMatrix, estimator)
      const predicted = walktrap(adjacency, originalCommunities, walktrapStep)
        .map(entry => entry.communityId)
      const aligned = alignCommunitiesToReference(predicted, originalCommunities)

      for (let index = 0; index < itemCount; index++) {
        if (aligned[index] === originalCommunities[index]) {
          stableCounts[index] += 1
        }
      }

      successfulIterations++
    } catch {
      // Skip failed bootstrap draws; stability is based on successful draws only.
    }
  }

  if (successfulIterations === 0) {
    return {
      stabilityScores: new Array(itemCount).fill(0),
      unstableIndices: new Set<number>(),
    }
  }

  const stabilityScores = stableCounts.map(count => count / successfulIterations)
  const unstableIndices = new Set(
    stabilityScores
      .map((score, index) => score < stabilityCutoff ? index : -1)
      .filter(index => index !== -1)
  )

  return { stabilityScores, unstableIndices }
}

export function alignCommunitiesToReference(
  predicted: number[],
  reference: number[],
): number[] {
  const overlaps = new Map<number, Map<number, number>>()

  for (let index = 0; index < predicted.length; index++) {
    const predictedId = predicted[index] ?? 0
    const referenceId = reference[index] ?? 0
    if (!overlaps.has(predictedId)) overlaps.set(predictedId, new Map<number, number>())
    const counts = overlaps.get(predictedId)!
    counts.set(referenceId, (counts.get(referenceId) ?? 0) + 1)
  }

  const mapping = new Map<number, number>()
  overlaps.forEach((counts, predictedId) => {
    const bestMatch = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
    mapping.set(predictedId, bestMatch?.[0] ?? predictedId)
  })

  return predicted.map(predictedId => mapping.get(predictedId) ?? predictedId)
}
