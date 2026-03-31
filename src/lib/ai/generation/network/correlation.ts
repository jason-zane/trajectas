/**
 * correlation.ts
 *
 * The paper treats embedding dimensions as observations and items as variables.
 * These helpers therefore operate on an item-by-dimension matrix, producing
 * item-item correlation structures and resampling embedding dimensions for
 * bootstrap EGA.
 */

const DEFAULT_SPARSE_RATIO = 0.10
const MIN_SPARSE_DIMENSIONS = 32

export function cosineSimilarityMatrix(embeddings: number[][]): number[][] {
  const n = embeddings.length
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0) as number[])

  const norms = embeddings.map(e => Math.sqrt(e.reduce((s, v) => s + v * v, 0)))

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1
    for (let j = i + 1; j < n; j++) {
      if (norms[i] === 0 || norms[j] === 0) {
        matrix[i][j] = matrix[j][i] = 0
        continue
      }
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
 * Pearson item-item correlation matrix across embedding dimensions.
 * This matches the paper's data orientation more closely than cosine similarity.
 */
export function itemCorrelationMatrix(embeddings: number[][]): number[][] {
  const n = embeddings.length
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0) as number[])

  const means = embeddings.map(vector =>
    vector.length === 0 ? 0 : vector.reduce((sum, value) => sum + value, 0) / vector.length
  )
  const centered = embeddings.map((vector, itemIndex) =>
    vector.map(value => value - means[itemIndex])
  )
  const norms = centered.map(vector => Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)))

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1
    for (let j = i + 1; j < n; j++) {
      if (norms[i] === 0 || norms[j] === 0) {
        matrix[i][j] = matrix[j][i] = 0
        continue
      }
      let covariance = 0
      for (let k = 0; k < centered[i].length; k++) {
        covariance += centered[i][k] * centered[j][k]
      }
      const correlation = covariance / (norms[i] * norms[j])
      matrix[i][j] = matrix[j][i] = Number.isFinite(correlation) ? correlation : 0
    }
  }

  return matrix
}

/**
 * Convert dense embeddings into a deterministic sparse representation by
 * retaining only the largest absolute dimensions per item.
 */
export function sparsifyEmbeddings(
  embeddings: number[][],
  ratio = DEFAULT_SPARSE_RATIO,
): number[][] {
  if (embeddings.length === 0) return []

  const dimensions = embeddings[0]?.length ?? 0
  const topK = Math.max(MIN_SPARSE_DIMENSIONS, Math.round(dimensions * ratio))

  return embeddings.map(vector => {
    if (vector.length <= topK) return [...vector]

    const keep = new Set(
      vector
        .map((value, index) => ({ index, magnitude: Math.abs(value) }))
        .sort((a, b) => b.magnitude - a.magnitude)
        .slice(0, topK)
        .map(entry => entry.index)
    )

    return vector.map((value, index) => keep.has(index) ? value : 0)
  })
}

/**
 * Bootstrap helper: resample embedding dimensions (observations) with replacement
 * while preserving the item-by-dimension orientation.
 */
export function resampleEmbeddingDimensions(
  embeddings: number[][],
): number[][] {
  if (embeddings.length === 0) return []

  const dimensionCount = embeddings[0]?.length ?? 0
  const sampledDimensions = Array.from(
    { length: dimensionCount },
    () => Math.floor(Math.random() * dimensionCount)
  )

  return embeddings.map(vector => sampledDimensions.map(index => vector[index] ?? 0))
}

/**
 * Compute the partial correlation matrix from a correlation matrix.
 *
 * Partial correlations control for shared variance: two items that correlate
 * only because they measure the same broad construct -> partial corr ~= 0.
 * Only near-duplicate items (unique shared variance) retain high values.
 *
 * Returns null if the matrix is singular.
 */
export function partialCorrelationMatrix(corrMatrix: number[][]): number[][] | null {
  const n = corrMatrix.length
  if (n < 2) return null

  const reg: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0.99 * corrMatrix[i][j]))
  )

  const inv = invertMatrix(reg)
  if (!inv) return null

  const pcor: number[][] = Array.from({ length: n }, () => new Array(n).fill(0) as number[])
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const denom = inv[i][i] * inv[j][j]
      if (denom <= 0) return null
      const val = -inv[i][j] / Math.sqrt(denom)
      if (!Number.isFinite(val)) return null
      pcor[i][j] = pcor[j][i] = val
    }
  }

  return pcor
}

function invertMatrix(matrix: number[][]): number[][] | null {
  const n = matrix.length
  const aug: number[][] = Array.from({ length: n }, (_, i) => {
    const row = new Array(2 * n).fill(0) as number[]
    for (let j = 0; j < n; j++) row[j] = matrix[i][j]
    row[n + i] = 1
    return row
  })

  for (let col = 0; col < n; col++) {
    let maxRow = col
    let maxVal = Math.abs(aug[col][col])
    for (let row = col + 1; row < n; row++) {
      const absVal = Math.abs(aug[row][col])
      if (absVal > maxVal) {
        maxVal = absVal
        maxRow = row
      }
    }
    if (maxVal < 1e-12) return null

    if (maxRow !== col) {
      const temp = aug[col]
      aug[col] = aug[maxRow]
      aug[maxRow] = temp
    }

    const pivot = aug[col][col]
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot

    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = aug[row][col]
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j]
    }
  }

  const inv: number[][] = Array.from({ length: n }, (_, i) => aug[i].slice(n))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (!Number.isFinite(inv[i][j])) return null
    }
  }

  return inv
}
