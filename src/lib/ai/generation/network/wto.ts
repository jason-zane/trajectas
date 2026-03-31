/**
 * wto.ts — Weighted Topological Overlap (wTO) redundancy detection
 *
 * Redundant sets are identified globally. Within each redundant pair/set, the
 * keeper is the item with the lowest overall overlap with the rest of the pool.
 */
import { itemCorrelationMatrix } from './correlation'
import { buildNetwork } from './network-builder'
import type { AdjacencyMatrix, RedundancyResult } from '@/types/generation'

export function computeWTO(adjacency: AdjacencyMatrix): number[][] {
  const n = adjacency.length
  const absAdj = adjacency.map(row => row.map(weight => Math.abs(weight)))
  const wto: number[][] = Array.from({ length: n }, () => new Array(n).fill(0) as number[])
  const degrees = absAdj.map(row => row.reduce((sum, value) => sum + value, 0))

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let sharedNeighbors = 0
      for (let u = 0; u < n; u++) {
        sharedNeighbors += absAdj[i][u]! * absAdj[j][u]!
      }
      const edgeWeight = absAdj[i][j]!
      const numerator = sharedNeighbors + edgeWeight
      const denominator = Math.min(degrees[i]!, degrees[j]!) + 1 - edgeWeight
      const score = denominator > 0 ? numerator / denominator : 0
      wto[i][j] = wto[j][i] = score
    }
  }

  return wto
}

export function findRedundantItems(
  adjacency: AdjacencyMatrix,
  cutoff: number,
): RedundancyResult {
  const n = adjacency.length
  const wtoMatrix = computeWTO(adjacency)
  const wtoScores = Array.from({ length: n }, (_, index) => rowMax(wtoMatrix[index]!))
  const redundantIndices = new Set<number>()

  for (const group of greedyRedundantSets(wtoMatrix, cutoff)) {
    if (group.length < 2) continue
    const keeper = keepMostUnique(group, wtoMatrix)
    group.forEach(index => {
      if (index !== keeper) redundantIndices.add(index)
    })
  }

  return { redundantIndices, wtoScores }
}

export function findRedundantItemsIterative(
  embeddings: number[][],
  cutoff: number,
  resolveAdjacency?: (corrMatrix: number[][]) => AdjacencyMatrix,
): RedundancyResult {
  const itemCount = embeddings.length
  const wtoScores = new Array<number>(itemCount).fill(0)
  const redundantIndices = new Set<number>()
  const removalSweepByIndex = new Map<number, number>()

  let active = Array.from({ length: itemCount }, (_, index) => index)
  let sweep = 0

  while (active.length >= 2) {
    sweep += 1
    const activeEmbeddings = active.map(index => embeddings[index]!)
    const corrMatrix = itemCorrelationMatrix(activeEmbeddings)
    const ggmAdjacency = resolveAdjacency
      ? resolveAdjacency(corrMatrix)
      : buildNetwork(corrMatrix, 'ebicglasso').adjacency
    const resolvedWto = computeWTO(ggmAdjacency)
    const groups = greedyRedundantSets(resolvedWto, cutoff)

    for (let subIndex = 0; subIndex < active.length; subIndex++) {
      const originalIndex = active[subIndex]!
      wtoScores[originalIndex] = Math.max(
        wtoScores[originalIndex] ?? 0,
        rowMax(resolvedWto[subIndex]!),
      )
    }

    if (groups.length === 0) break

    const victims = new Set<number>()
    for (const group of groups) {
      if (group.length < 2) continue
      const keeper = keepMostUnique(group, resolvedWto)
      group.forEach(subIndex => {
        if (subIndex === keeper) return
        victims.add(subIndex)
      })
    }

    if (victims.size === 0) break

    victims.forEach(subIndex => {
      const originalIndex = active[subIndex]!
      redundantIndices.add(originalIndex)
      removalSweepByIndex.set(originalIndex, sweep)
    })

    active = active.filter((_, subIndex) => !victims.has(subIndex))
  }

  return { redundantIndices, wtoScores, removalSweepByIndex, sweepCount: sweep }
}

function greedyRedundantSets(wtoMatrix: number[][], cutoff: number): number[][] {
  const edgeList: Array<{ a: number; b: number; weight: number }> = []
  for (let i = 0; i < wtoMatrix.length; i++) {
    for (let j = i + 1; j < wtoMatrix.length; j++) {
      const weight = wtoMatrix[i]?.[j] ?? 0
      if (weight > cutoff) {
        edgeList.push({ a: i, b: j, weight })
      }
    }
  }

  edgeList.sort((left, right) => right.weight - left.weight)

  const groups: number[][] = []
  const membership = new Map<number, number>()

  for (const { a, b } of edgeList) {
    const groupA = membership.get(a)
    const groupB = membership.get(b)

    if (groupA === undefined && groupB === undefined) {
      const nextIndex = groups.length
      groups.push([a, b])
      membership.set(a, nextIndex)
      membership.set(b, nextIndex)
      continue
    }

    if (groupA !== undefined && groupB === undefined) {
      const group = groups[groupA]!
      if (canJoinDenseGroup(b, group, wtoMatrix, cutoff)) {
        group.push(b)
        membership.set(b, groupA)
      }
      continue
    }

    if (groupA === undefined && groupB !== undefined) {
      const group = groups[groupB]!
      if (canJoinDenseGroup(a, group, wtoMatrix, cutoff)) {
        group.push(a)
        membership.set(a, groupB)
      }
      continue
    }

    if (groupA === groupB) continue

    const left = groups[groupA!]!
    const right = groups[groupB!]!
    if (!canMergeDenseGroups(left, right, wtoMatrix, cutoff)) continue

    const merged = [...left, ...right]
    groups[groupA!] = merged
    groups[groupB!] = []
    merged.forEach(node => membership.set(node, groupA!))
  }

  return groups.filter(group => group.length > 1)
}

function canJoinDenseGroup(
  candidate: number,
  group: number[],
  wtoMatrix: number[][],
  cutoff: number,
): boolean {
  return group.every(member => (wtoMatrix[candidate]?.[member] ?? 0) > cutoff)
}

function canMergeDenseGroups(
  left: number[],
  right: number[],
  wtoMatrix: number[][],
  cutoff: number,
): boolean {
  return left.every(a => right.every(b => (wtoMatrix[a]?.[b] ?? 0) > cutoff))
}

function keepMostUnique(component: number[], wtoMatrix: number[][]): number {
  return [...component].sort((a, b) => {
    const meanDiff = rowMean(wtoMatrix[a]!) - rowMean(wtoMatrix[b]!)
    if (meanDiff !== 0) return meanDiff
    return rowMax(wtoMatrix[a]!) - rowMax(wtoMatrix[b]!)
  })[0]!
}

function rowMean(row: number[]): number {
  const values = row.filter(value => value > 0)
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function rowMax(row: number[]): number {
  return row.reduce((max, value) => value > max ? value : max, 0)
}
