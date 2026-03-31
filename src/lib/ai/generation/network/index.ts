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
} from '@/types/generation'

export class NetworkAnalyzerImpl implements NetworkAnalyzer {
  buildNetwork(correlationMatrix: number[][]): AdjacencyMatrix {
    return buildNetwork(correlationMatrix).adjacency
  }
  detectCommunities(adjacency: AdjacencyMatrix): CommunityAssignment[] {
    const n = adjacency.length
    const labels = new Array<number>(n).fill(0)
    return walktrap(adjacency, labels)
  }
  computeNMI(predicted: number[], actual: number[]): number {
    return computeNMI(predicted, actual)
  }
  findRedundantItems(adjacency: AdjacencyMatrix, cutoff: number): RedundancyResult {
    return findRedundantItems(adjacency, cutoff)
  }
  bootstrapStability(
    embeddings:  number[][],
    nBootstraps: number,
    cutoff:      number,
  ): StabilityResult {
    const n      = embeddings.length
    const labels = new Array<number>(n).fill(0)
    return bootstrapStability(embeddings, labels, nBootstraps, cutoff)
  }
}

export { cosineSimilarityMatrix, partialCorrelationMatrix } from './correlation'
export { buildNetwork, isConnected }         from './network-builder'
export { buildTMFG }                         from './tmfg'
export { walktrap }                          from './walktrap'
export { computeNMI, computeAMI }            from './nmi'
export { findRedundantItems, findRedundantItemsIterative, computeWTO } from './wto'
export { bootstrapStability }                from './bootstrap'
export { detectLeakage }                     from './leakage'
export type { LeakageResult }                from './leakage'
