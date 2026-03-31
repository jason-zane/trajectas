/**
 * network-builder.ts
 *
 * Builds an item network from an item-item correlation matrix using either
 * TMFG or a sparse partial-correlation approximation of EBICglasso.
 */
import type { AdjacencyMatrix } from '@/types/generation'
import type { NetworkEstimator } from '@/types/generation'
import { partialCorrelationMatrix } from './correlation'
import { buildTMFG } from './tmfg'

export interface NetworkResult {
  adjacency: AdjacencyMatrix
  threshold: number
  edgeCount: number
  estimator: NetworkEstimator
}

export function buildNetwork(
  correlationMatrix: number[][],
  estimator: NetworkEstimator = 'tmfg',
): NetworkResult {
  const adjacency = estimator === 'ebicglasso'
    ? buildEbicGlassoApproximation(correlationMatrix)
    : buildTMFG(correlationMatrix)

  const n = correlationMatrix.length
  let edgeCount = 0
  let minWeight = Infinity
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (adjacency[i][j] !== 0) {
        edgeCount++
        const weight = Math.abs(adjacency[i][j])
        if (weight < minWeight) minWeight = weight
      }
    }
  }

  return {
    adjacency,
    threshold: edgeCount > 0 ? minWeight : 0,
    edgeCount,
    estimator,
  }
}

/**
 * Practical EBICglasso-style fallback without a dedicated optimizer:
 * 1. estimate a partial-correlation matrix
 * 2. keep only edges above a data-driven absolute threshold
 * 3. connect components with the strongest remaining edges
 */
function buildEbicGlassoApproximation(correlationMatrix: number[][]): AdjacencyMatrix {
  const n = correlationMatrix.length
  if (n === 0) return []
  if (n <= 3) {
    return Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i !== j ? correlationMatrix[i][j] : 0))
    )
  }

  const partial = partialCorrelationMatrix(correlationMatrix)
  if (!partial) {
    return buildTMFG(correlationMatrix)
  }

  const magnitudes: number[] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      magnitudes.push(Math.abs(partial[i][j]))
    }
  }

  const sorted = [...magnitudes].sort((a, b) => a - b)
  const threshold = quantile(sorted, 0.7)
  const adjacency: AdjacencyMatrix = Array.from({ length: n }, () => new Array<number>(n).fill(0))

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(partial[i][j]) >= threshold) {
        adjacency[i][j] = partial[i][j]
        adjacency[j][i] = partial[j][i]
      }
    }
  }

  connectComponents(adjacency, partial)
  return adjacency
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const position = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)))
  return sorted[position] ?? 0
}

function connectComponents(
  adjacency: AdjacencyMatrix,
  sourceWeights: number[][],
): void {
  const components = getComponents(adjacency)
  if (components.length <= 1) return

  while (components.length > 1) {
    let bestA = -1
    let bestB = -1
    let bestI = -1
    let bestJ = -1
    let bestWeight = -Infinity

    for (let a = 0; a < components.length; a++) {
      for (let b = a + 1; b < components.length; b++) {
        for (const i of components[a]!) {
          for (const j of components[b]!) {
            const magnitude = Math.abs(sourceWeights[i]?.[j] ?? 0)
            if (magnitude > bestWeight) {
              bestWeight = magnitude
              bestA = a
              bestB = b
              bestI = i
              bestJ = j
            }
          }
        }
      }
    }

    if (bestI === -1 || bestJ === -1) break

    adjacency[bestI][bestJ] = sourceWeights[bestI][bestJ]
    adjacency[bestJ][bestI] = sourceWeights[bestJ][bestI]

    const merged = [...components[bestA]!, ...components[bestB]!]
    components.splice(bestB, 1)
    components.splice(bestA, 1, merged)
  }
}

function getComponents(adjacency: AdjacencyMatrix): number[][] {
  const n = adjacency.length
  const visited = new Set<number>()
  const components: number[][] = []

  for (let start = 0; start < n; start++) {
    if (visited.has(start)) continue
    const component: number[] = []
    const queue = [start]
    visited.add(start)
    while (queue.length > 0) {
      const node = queue.shift()!
      component.push(node)
      for (let next = 0; next < n; next++) {
        if (adjacency[node][next] === 0 || visited.has(next)) continue
        visited.add(next)
        queue.push(next)
      }
    }
    components.push(component)
  }

  return components
}

export function isConnected(adj: AdjacencyMatrix, n: number): boolean {
  if (n === 0) return true
  return getComponents(adj).length === 1
}
