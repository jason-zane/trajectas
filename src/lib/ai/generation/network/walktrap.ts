/**
 * walktrap.ts — Walktrap-style community detection
 *
 * Uses random-walk feature vectors and Ward-style agglomerative merges,
 * tracking the partition with the best modularity on the weighted network.
 */
import type { AdjacencyMatrix, CommunityAssignment } from '@/types/generation'

const DEFAULT_WALK_LENGTH = 4

interface Cluster {
  id: number
  members: number[]
  centroid: number[]
  size: number
}

export function walktrap(
  adjacency: AdjacencyMatrix,
  constructLabels: number[],
  walkLength = DEFAULT_WALK_LENGTH,
): CommunityAssignment[] {
  const n = adjacency.length
  if (n === 0) return []
  if (n === 1) return [{ itemIndex: 0, communityId: 0, stability: 0 }]

  const positiveAdj = adjacency.map(row => row.map(weight => Math.abs(weight)))
  const degrees = positiveAdj.map(row => row.reduce((sum, value) => sum + value, 0))
  const totalVolume = degrees.reduce((sum, degree) => sum + degree, 0) || 1
  const P: number[][] = positiveAdj.map((row, i) =>
    row.map(value => degrees[i] > 0 ? value / degrees[i] : 0)
  )

  let Pt = cloneMatrix(P)
  for (let step = 1; step < walkLength; step++) {
    Pt = matMul(Pt, P)
  }

  const features = Pt.map(row =>
    row.map((value, index) => value / Math.sqrt((degrees[index] / totalVolume) || 1e-10))
  )

  let clusters: Cluster[] = features.map((feature, index) => ({
    id: index,
    members: [index],
    centroid: feature,
    size: 1,
  }))

  let bestAssignments = assignmentsFromClusters(clusters, n)
  let bestModularity = computeModularity(positiveAdj, bestAssignments, degrees, totalVolume)

  while (clusters.length > 1) {
    let bestPair: [number, number] | null = null
    let bestDelta = Infinity

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const delta = wardDelta(clusters[i]!, clusters[j]!)
        if (delta < bestDelta) {
          bestDelta = delta
          bestPair = [i, j]
        }
      }
    }

    if (!bestPair) break

    const [aIndex, bIndex] = bestPair
    const a = clusters[aIndex]!
    const b = clusters[bIndex]!
    const mergedSize = a.size + b.size
    const mergedCentroid = a.centroid.map((value, index) =>
      ((value * a.size) + (b.centroid[index]! * b.size)) / mergedSize
    )

    const merged: Cluster = {
      id: a.id,
      members: [...a.members, ...b.members],
      centroid: mergedCentroid,
      size: mergedSize,
    }

    clusters = clusters.filter((_, index) => index !== aIndex && index !== bIndex)
    clusters.push(merged)

    const assignments = assignmentsFromClusters(clusters, n)
    const modularity = computeModularity(positiveAdj, assignments, degrees, totalVolume)
    if (modularity >= bestModularity) {
      bestModularity = modularity
      bestAssignments = assignments
    }
  }

  void constructLabels

  return bestAssignments.map((communityId, itemIndex) => ({
    itemIndex,
    communityId,
    stability: 0,
  }))
}

function cloneMatrix(matrix: number[][]): number[][] {
  return matrix.map(row => [...row])
}

function matMul(A: number[][], B: number[][]): number[][] {
  const n = A.length
  const C: number[][] = Array.from({ length: n }, () => new Array(n).fill(0) as number[])
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      if (A[i]![k] === 0) continue
      for (let j = 0; j < n; j++) {
        C[i]![j] += A[i]![k]! * B[k]![j]!
      }
    }
  }
  return C
}

function wardDelta(a: Cluster, b: Cluster): number {
  let distSq = 0
  for (let i = 0; i < a.centroid.length; i++) {
    const diff = a.centroid[i]! - b.centroid[i]!
    distSq += diff * diff
  }
  return (a.size * b.size) / (a.size + b.size) * distSq
}

function assignmentsFromClusters(clusters: Cluster[], itemCount: number): number[] {
  const assignments = new Array<number>(itemCount).fill(0)
  clusters.forEach((cluster, clusterIndex) => {
    cluster.members.forEach(member => {
      assignments[member] = clusterIndex
    })
  })
  return assignments
}

function computeModularity(
  adjacency: AdjacencyMatrix,
  communities: number[],
  degrees: number[],
  totalVolume: number,
): number {
  const m = totalVolume / 2
  if (m === 0) return 0

  let modularity = 0
  for (let i = 0; i < adjacency.length; i++) {
    for (let j = 0; j < adjacency.length; j++) {
      if (communities[i] !== communities[j]) continue
      modularity += adjacency[i]![j]! - (degrees[i]! * degrees[j]!) / (2 * m)
    }
  }

  return modularity / (2 * m)
}
