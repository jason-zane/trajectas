/**
 * network/index.ts — NetworkAnalyzerImpl + barrel export
 *
 * Implements the NetworkAnalyzer interface from @/types/generation using
 * the TypeScript algorithms in this directory.
 */
import { buildNetwork }                  from './network-builder'
import { walktrap }                      from './walktrap'
import { computeNMI }                    from './nmi'
import { findRedundantItems }            from './wto'
import { bootstrapStability }            from './bootstrap'
import type {
  NetworkAnalyzer,
  AdjacencyMatrix,
  CommunityAssignment,
  RedundancyResult,
  StabilityResult,
  NetworkEstimator,
} from '@/types/generation'

export class NetworkAnalyzerImpl implements NetworkAnalyzer {
  buildNetwork(correlationMatrix: number[][], estimator: NetworkEstimator = 'tmfg'): AdjacencyMatrix {
    return buildNetwork(correlationMatrix, estimator).adjacency
  }
  detectCommunities(adjacency: AdjacencyMatrix, walktrapStep = 4): CommunityAssignment[] {
    const n = adjacency.length
    const labels = new Array<number>(n).fill(0)
    return walktrap(adjacency, labels, walktrapStep)
  }
  computeNMI(predicted: number[], actual: number[]): number {
    return computeNMI(predicted, actual)
  }
  findRedundantItems(adjacency: AdjacencyMatrix, cutoff: number): RedundancyResult {
    return findRedundantItems(adjacency, cutoff)
  }
  bootstrapStability(
    embeddings: number[][],
    originalCommunities: number[],
    estimator: NetworkEstimator,
    walktrapStep: number,
    nBootstraps: number,
    cutoff: number,
  ): StabilityResult {
    return bootstrapStability(
      embeddings,
      originalCommunities,
      estimator,
      walktrapStep,
      nBootstraps,
      cutoff,
    )
  }
}

export {
  cosineSimilarityMatrix,
  itemCorrelationMatrix,
  partialCorrelationMatrix,
  sparsifyEmbeddings,
  resampleEmbeddingDimensions,
} from './correlation'
export { buildNetwork, isConnected }         from './network-builder'
export { buildTMFG }                         from './tmfg'
export { walktrap }                          from './walktrap'
export { computeNMI, computeAMI }            from './nmi'
export { findRedundantItems, findRedundantItemsIterative, computeWTO } from './wto'
export { bootstrapStability }                from './bootstrap'
export { detectLeakage }                     from './leakage'
export type { LeakageResult }                from './leakage'
