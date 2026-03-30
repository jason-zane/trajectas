/**
 * correlation.ts
 * Computes a pairwise cosine similarity matrix from embedding vectors.
 * Returns an n×n matrix where entry [i][j] = cosine similarity of items i and j.
 */

export function cosineSimilarityMatrix(embeddings: number[][]): number[][] {
  const n = embeddings.length
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0) as number[])

  // Pre-compute norms
  const norms = embeddings.map(e => Math.sqrt(e.reduce((s, v) => s + v * v, 0)))

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1
    for (let j = i + 1; j < n; j++) {
      if (norms[i] === 0 || norms[j] === 0) { matrix[i][j] = matrix[j][i] = 0; continue }
      let dot = 0
      for (let k = 0; k < embeddings[i].length; k++) {
        dot += embeddings[i][k] * embeddings[j][k]
      }
      const sim = dot / (norms[i] * norms[j])
      matrix[i][j] = matrix[j][i] = sim
    }
  }
  return matrix
}
