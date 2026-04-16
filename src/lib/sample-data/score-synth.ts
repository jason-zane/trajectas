/**
 * Deterministic sample POMP score for preview data.
 *
 * Maps (entityId, salt) → integer in [20, 90]. Avoids 0/100 extremes so
 * bands render realistically. Uses a simple FNV-1a hash; cryptographic
 * strength is not required.
 */
export function synthScore(entityId: string, salt = 'sample'): number {
  const input = `${entityId}:${salt}`
  let hash = 0x811c9dc5 // FNV-1a offset basis (32-bit)
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) // FNV prime
  }
  // Scale into 20..90 inclusive (71 values)
  const unsigned = hash >>> 0
  return 20 + (unsigned % 71)
}
