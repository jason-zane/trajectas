/**
 * walktrap.ts — Random-walk community detection
 *
 * Implementation of the Walktrap algorithm (Pons & Latapy, 2005).
 * Uses random walks of length t=4 to compute structural distances between nodes,
 * then applies Ward-style hierarchical clustering cut at maximum modularity.
 *
 * Returns one CommunityAssignment per item.
 */
import type { AdjacencyMatrix, CommunityAssignment } from '@/types/generation'

const WALK_LENGTH = 4

export function walktrap(
  adjacency: AdjacencyMatrix,
  constructLabels: number[],   // true construct label per item (for modularity calculation)
): CommunityAssignment[] {
  const n = adjacency.length
  if (n === 0) return []
  if (n === 1) return [{ itemIndex: 0, communityId: 0, stability: 0 }]

  // Step 1: Compute transition matrix P = D^{-1} A
  const degrees = adjacency.map(row => row.reduce((s, v) => s + v, 0))
  const P: number[][] = adjacency.map((row, i) =>
    row.map(v => (degrees[i] > 0 ? v / degrees[i] : 0))
  )

  // Step 2: Compute P^t via repeated matrix multiplication
  let Pt = matMul(P, P)
  for (let k = 2; k < WALK_LENGTH; k++) {
    Pt = matMul(Pt, P)
  }

  // Step 3: Compute Walktrap distance between nodes i and j
  // d(i,j)^2 = sum_k (Pt[i][k]/deg[i] - Pt[j][k]/deg[j])^2 / (1/vol * deg[k])
  // Simplified: squared Euclidean distance on degree-normalised rows of Pt
  const totalVolume = degrees.reduce((s, d) => s + d, 0) || 1
  const distMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0) as number[])
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let d = 0
      for (let k = 0; k < n; k++) {
        const dk = degrees[k] / totalVolume || 1e-10
        const diff = Pt[i][k] - Pt[j][k]
        d += (diff * diff) / dk
      }
      distMatrix[i][j] = distMatrix[j][i] = Math.sqrt(d)
    }
  }

  // Step 4: Hierarchical clustering (single-linkage) cutting at max modularity
  // Start: each node is its own community
  let communities = Array.from({ length: n }, (_, i) => i)
  let bestCommunities = [...communities]
  let bestModularity = computeModularity(adjacency, communities, degrees, totalVolume)

  // Agglomerative merge: greedily merge the pair with minimum distance
  const merged = new Set<number>()
  for (let step = 0; step < n - 1; step++) {
    let minDist = Infinity
    let mergeA = -1, mergeB = -1

    for (let i = 0; i < n; i++) {
      if (merged.has(i)) continue
      for (let j = i + 1; j < n; j++) {
        if (merged.has(j)) continue
        if (distMatrix[i][j] < minDist) {
          minDist = distMatrix[i][j]
          mergeA = i
          mergeB = j
        }
      }
    }

    if (mergeA === -1) break

    // Merge: all nodes with community = mergeB get community = mergeA
    const fromCom = communities[mergeB]
    const toCom   = communities[mergeA]
    for (let i = 0; i < n; i++) {
      if (communities[i] === fromCom) communities[i] = toCom
    }
    merged.add(mergeB)

    // Re-label communities to be contiguous before modularity check
    const relabeled = relabelCommunities(communities)
    const q = computeModularity(adjacency, relabeled, degrees, totalVolume)
    if (q >= bestModularity) {
      bestModularity = q
      bestCommunities = [...relabeled]
    }
  }

  // constructLabels is used to validate community structure externally via NMI;
  // stability scores are populated later by bootEGA.
  void constructLabels

  return bestCommunities.map((communityId, itemIndex) => ({
    itemIndex,
    communityId,
    stability: 0,
  }))
}

function matMul(A: number[][], B: number[][]): number[][] {
  const n = A.length
  const C: number[][] = Array.from({ length: n }, () => new Array(n).fill(0) as number[])
  for (let i = 0; i < n; i++)
    for (let k = 0; k < n; k++) {
      if (A[i][k] === 0) continue
      for (let j = 0; j < n; j++)
        C[i][j] += A[i][k] * B[k][j]
    }
  return C
}

function computeModularity(
  adj: AdjacencyMatrix,
  communities: number[],
  degrees: number[],
  totalVolume: number,
): number {
  let Q = 0
  const m = totalVolume / 2  // number of edges (total degree / 2)
  if (m === 0) return 0
  for (let i = 0; i < adj.length; i++) {
    for (let j = 0; j < adj.length; j++) {
      if (communities[i] !== communities[j]) continue
      Q += adj[i][j] - (degrees[i] * degrees[j]) / (2 * m)
    }
  }
  return Q / (2 * m)
}

function relabelCommunities(communities: number[]): number[] {
  const map = new Map<number, number>()
  let next = 0
  return communities.map(c => {
    if (!map.has(c)) map.set(c, next++)
    return map.get(c)!
  })
}
