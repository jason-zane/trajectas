/**
 * network-builder.ts
 *
 * Builds a weighted adjacency matrix from a correlation/similarity matrix
 * using TMFG (Triangulated Maximally Filtered Graph). Produces a sparse planar
 * graph with exactly 3n-6 edges. Edges carry their correlation weight so that
 * downstream wTO produces differentiated scores instead of all-1.0.
 */
import type { AdjacencyMatrix } from '@/types/generation'
import { buildTMFG }            from './tmfg'

export interface NetworkResult {
  adjacency:  AdjacencyMatrix
  threshold:  number
  edgeCount:  number
}

export function buildNetwork(correlationMatrix: number[][]): NetworkResult {
  const n = correlationMatrix.length
  const adjacency = buildTMFG(correlationMatrix)

  // Count edges and find the minimum edge weight (weakest included edge)
  let edgeCount = 0
  let minWeight = Infinity
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (adjacency[i][j]) {
        edgeCount++
        const w = adjacency[i][j]
        if (w < minWeight) minWeight = w
      }
    }
  }

  return {
    adjacency,
    threshold: edgeCount > 0 ? minWeight : 0,
    edgeCount,
  }
}

/** BFS connectivity check — kept as exported utility. */
export function isConnected(adj: AdjacencyMatrix, n: number): boolean {
  if (n === 0) return true
  const visited = new Set<number>([0])
  const queue = [0]
  while (queue.length > 0) {
    const node = queue.shift()!
    for (let j = 0; j < n; j++) {
      if (adj[node][j] && !visited.has(j)) {
        visited.add(j)
        queue.push(j)
      }
    }
  }
  return visited.size === n
}
