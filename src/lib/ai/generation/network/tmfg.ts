/**
 * tmfg.ts — Triangulated Maximally Filtered Graph (Massara et al., 2016)
 *
 * Builds a sparse planar graph with exactly 3n-6 edges from a correlation
 * matrix. The selection objective follows the paper's description: maximize
 * absolute correlation while preserving the original sign on retained edges.
 */
import type { AdjacencyMatrix } from '@/types/generation'

export function buildTMFG(correlationMatrix: number[][]): AdjacencyMatrix {
  const n = correlationMatrix.length

  // Edge cases
  if (n === 0) return []
  if (n <= 3) {
    // Return complete weighted graph for tiny inputs
    return Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i !== j ? correlationMatrix[i][j] : 0)),
    )
  }

  const adj: AdjacencyMatrix = Array.from({ length: n }, () =>
    new Array<number>(n).fill(0),
  )
  const inserted = new Set<number>()

  // -------------------------------------------------------------------------
  // Find the best starting tetrahedron (4 nodes, 6 edges, 4 triangular faces)
  // -------------------------------------------------------------------------
  const [a, b] = findBestPair(correlationMatrix, n)
  const c = findBestNode(correlationMatrix, n, [a, b], inserted)
  const d = findBestNode(correlationMatrix, n, [a, b, c], inserted)

  for (const node of [a, b, c, d]) inserted.add(node)
  addEdge(adj, correlationMatrix, a, b)
  addEdge(adj, correlationMatrix, a, c)
  addEdge(adj, correlationMatrix, a, d)
  addEdge(adj, correlationMatrix, b, c)
  addEdge(adj, correlationMatrix, b, d)
  addEdge(adj, correlationMatrix, c, d)

  // Triangular faces — each face is a triple of node indices
  const faces: [number, number, number][] = [
    [a, b, c],
    [a, b, d],
    [a, c, d],
    [b, c, d],
  ]

  // -------------------------------------------------------------------------
  // Greedy insertion: add remaining nodes one at a time
  // -------------------------------------------------------------------------
  while (inserted.size < n) {
    let bestNode = -1
    let bestFaceIdx = -1
    let bestGain = -Infinity

    // For each uninserted node, find the face that maximises the sum of
    // similarity to its three vertices
    for (let v = 0; v < n; v++) {
      if (inserted.has(v)) continue
      for (let fi = 0; fi < faces.length; fi++) {
        const [f0, f1, f2] = faces[fi]
        const gain =
          Math.abs(correlationMatrix[v][f0]) +
          Math.abs(correlationMatrix[v][f1]) +
          Math.abs(correlationMatrix[v][f2])
        if (gain > bestGain) {
          bestGain = gain
          bestNode = v
          bestFaceIdx = fi
        }
      }
    }

    if (bestNode === -1) break // shouldn't happen

    // Insert: connect new node to the 3 face vertices, replace face with 3 new
    const [f0, f1, f2] = faces[bestFaceIdx]
    inserted.add(bestNode)
    addEdge(adj, correlationMatrix, bestNode, f0)
    addEdge(adj, correlationMatrix, bestNode, f1)
    addEdge(adj, correlationMatrix, bestNode, f2)

    // Remove the old face and add 3 new faces
    faces[bestFaceIdx] = [bestNode, f0, f1] // reuse slot
    faces.push([bestNode, f0, f2])
    faces.push([bestNode, f1, f2])
  }

  return adj
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find the pair with highest similarity. */
function findBestPair(sim: number[][], n: number): [number, number] {
  let bestI = 0
  let bestJ = 1
  let bestVal = -Infinity
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const magnitude = Math.abs(sim[i][j])
      if (magnitude > bestVal) {
        bestVal = magnitude
        bestI = i
        bestJ = j
      }
    }
  }
  return [bestI, bestJ]
}

/** Find the node not in `exclude` that maximises total similarity to `targets`. */
function findBestNode(
  sim: number[][],
  n: number,
  targets: number[],
  alreadyInserted: Set<number>,
): number {
  let best = -1
  let bestVal = -Infinity
  for (let v = 0; v < n; v++) {
    if (targets.includes(v) || alreadyInserted.has(v)) continue
    const total = targets.reduce((sum, t) => sum + Math.abs(sim[v][t]), 0)
    if (total > bestVal) {
      bestVal = total
      best = v
    }
  }
  return best
}

function addEdge(adj: AdjacencyMatrix, sim: number[][], i: number, j: number): void {
  adj[i][j] = sim[i][j]
  adj[j][i] = sim[j][i]
}
