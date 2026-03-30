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

/**
 * Compute the partial correlation matrix from a correlation matrix.
 *
 * Partial correlations control for shared variance: two items that correlate
 * only because they measure the same broad construct → partial corr ≈ 0.
 * Only near-duplicate items (unique shared variance) retain high values.
 *
 * Algorithm:
 *  1. Regularise via diagonal shrinkage (ensures positive definiteness)
 *  2. Invert via Gauss-Jordan with partial pivoting
 *  3. Convert precision matrix Θ to partial correlations:
 *     pcor[i][j] = -Θ[i][j] / √(Θ[i][i] × Θ[j][j])
 *  4. Return |pcor| with diagonal = 0
 *
 * Returns null if the matrix is singular (NaN/Infinity detected).
 */
export function partialCorrelationMatrix(corrMatrix: number[][]): number[][] | null {
  const n = corrMatrix.length
  if (n < 2) return null

  // 1. Regularise: shrink off-diagonal by 1% toward zero
  const reg: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0.99 * corrMatrix[i][j]))
  )

  // 2. Invert via Gauss-Jordan with partial pivoting
  const inv = invertMatrix(reg)
  if (!inv) return null

  // 3. Convert precision matrix to absolute partial correlations
  const pcor: number[][] = Array.from({ length: n }, () => new Array(n).fill(0) as number[])
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const denom = inv[i][i] * inv[j][j]
      if (denom <= 0) return null
      const val = Math.abs(-inv[i][j] / Math.sqrt(denom))
      if (!Number.isFinite(val)) return null
      pcor[i][j] = pcor[j][i] = val
    }
  }

  return pcor
}

/** Gauss-Jordan matrix inversion with partial pivoting. Returns null if singular. */
function invertMatrix(matrix: number[][]): number[][] | null {
  const n = matrix.length
  // Augmented matrix [A | I]
  const aug: number[][] = Array.from({ length: n }, (_, i) => {
    const row = new Array(2 * n).fill(0) as number[]
    for (let j = 0; j < n; j++) row[j] = matrix[i][j]
    row[n + i] = 1
    return row
  })

  for (let col = 0; col < n; col++) {
    // Partial pivoting: find row with largest absolute value in this column
    let maxRow = col
    let maxVal = Math.abs(aug[col][col])
    for (let row = col + 1; row < n; row++) {
      const absVal = Math.abs(aug[row][col])
      if (absVal > maxVal) { maxVal = absVal; maxRow = row }
    }
    if (maxVal < 1e-12) return null // singular

    // Swap rows
    if (maxRow !== col) {
      const tmp = aug[col]
      aug[col] = aug[maxRow]
      aug[maxRow] = tmp
    }

    // Scale pivot row
    const pivot = aug[col][col]
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot

    // Eliminate column in all other rows
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = aug[row][col]
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j]
    }
  }

  // Extract inverse from right half
  const inv: number[][] = Array.from({ length: n }, (_, i) =>
    aug[i].slice(n)
  )

  // Validate — check for NaN/Infinity
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (!Number.isFinite(inv[i][j])) return null
    }
  }

  return inv
}
