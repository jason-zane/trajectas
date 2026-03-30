/**
 * network-builder.ts
 *
 * Builds an unweighted adjacency matrix from a correlation matrix using an
 * adaptive threshold. Starting at 0.3, the threshold is adjusted up if the
 * network is too dense (>50% possible edges) or down if too sparse
 * (disconnected components exist).
 *
 * Returns the adjacency matrix and the chosen threshold.
 */
import type { AdjacencyMatrix } from '@/types/generation'

export interface NetworkResult {
  adjacency:  AdjacencyMatrix
  threshold:  number
  edgeCount:  number
}

export function buildNetwork(
  correlationMatrix: number[][],
  initialThreshold = 0.3,
): NetworkResult {
  const n = correlationMatrix.length
  const maxEdges = (n * (n - 1)) / 2

  let threshold = initialThreshold
  let adjacency = applyThreshold(correlationMatrix, threshold)

  // Adjust threshold to avoid extremes
  for (let attempt = 0; attempt < 10; attempt++) {
    const edgeCount = countEdges(adjacency, n)
    const density = edgeCount / maxEdges

    if (density > 0.5) {
      threshold += 0.05
      adjacency = applyThreshold(correlationMatrix, threshold)
    } else if (!isConnected(adjacency, n) && threshold > 0.1) {
      threshold -= 0.05
      adjacency = applyThreshold(correlationMatrix, threshold)
    } else {
      break
    }
  }

  return { adjacency, threshold, edgeCount: countEdges(adjacency, n) }
}

function applyThreshold(matrix: number[][], threshold: number): AdjacencyMatrix {
  return matrix.map((row, i) =>
    row.map((val, j) => (i !== j && val >= threshold) ? 1 : 0)
  )
}

function countEdges(adj: AdjacencyMatrix, n: number): number {
  let count = 0
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      if (adj[i][j]) count++
  return count
}

function isConnected(adj: AdjacencyMatrix, n: number): boolean {
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
