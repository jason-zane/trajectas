/**
 * leakage-guard.ts
 *
 * Manages construct centroids and checks items for cross-construct leakage
 * during generation. Uses cosine similarity to detect items that are
 * semantically closer to a different construct than their intended one.
 */

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export class ConstructCentroidCache {
  private centroids = new Map<string, { sum: number[]; count: number }>()

  /** Seed a construct centroid from its definition embedding. */
  seed(constructId: string, embedding: number[]): void {
    this.centroids.set(constructId, { sum: [...embedding], count: 1 })
  }

  /** Incrementally update a construct's centroid with a new item embedding. */
  addItem(constructId: string, embedding: number[]): void {
    const entry = this.centroids.get(constructId)
    if (!entry) return
    for (let i = 0; i < embedding.length; i++) {
      entry.sum[i] += embedding[i]
    }
    entry.count += 1
  }

  /** Get the current centroid (average) for a construct. */
  getCentroid(constructId: string): number[] | undefined {
    const entry = this.centroids.get(constructId)
    if (!entry) return undefined
    return entry.sum.map((v) => v / entry.count)
  }

  /** Get all construct IDs in the cache. */
  getConstructIds(): string[] {
    return [...this.centroids.keys()]
  }
}

export interface LeakageResult {
  isLeaking: boolean
  leakageScore: number
  leakageTarget?: string
}

export function checkItemLeakage(
  itemEmbedding: number[],
  targetConstructId: string,
  centroidCache: ConstructCentroidCache,
): LeakageResult {
  const targetCentroid = centroidCache.getCentroid(targetConstructId)
  if (!targetCentroid) {
    return { isLeaking: false, leakageScore: 0 }
  }

  const targetSimilarity = cosineSimilarity(itemEmbedding, targetCentroid)
  let maxOtherSimilarity = -1
  let maxOtherConstructId: string | undefined

  for (const constructId of centroidCache.getConstructIds()) {
    if (constructId === targetConstructId) continue
    const centroid = centroidCache.getCentroid(constructId)
    if (!centroid) continue
    const similarity = cosineSimilarity(itemEmbedding, centroid)
    if (similarity > maxOtherSimilarity) {
      maxOtherSimilarity = similarity
      maxOtherConstructId = constructId
    }
  }

  if (maxOtherSimilarity < 0) {
    return { isLeaking: false, leakageScore: 0 }
  }

  return {
    isLeaking: maxOtherSimilarity >= targetSimilarity,
    leakageScore: maxOtherSimilarity,
    leakageTarget: maxOtherSimilarity >= targetSimilarity ? maxOtherConstructId : undefined,
  }
}
