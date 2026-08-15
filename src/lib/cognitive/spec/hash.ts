import 'server-only'
import { createHash } from 'node:crypto'

/**
 * Deterministically serialise an arbitrary JSON-compatible value: object keys
 * sorted recursively (arrays keep their given order — order is meaningful
 * there, e.g. grid.cells / rules). This is what makes `contentHash` stable
 * regardless of the order fields happened to be constructed in.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value))
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep)
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key])
    }
    return sorted
  }
  return value
}

/**
 * Content-address a spec (or any JSON-serialisable value): sha256 of its
 * canonical form, prefixed `sha256:` per doc 03 (item-generation-pipeline)
 * §2.4's worked example. Used for `cognitive_item_specs.content_hash` and for
 * the reproducibility contract ((generator_version, git_sha, seed, params) ->
 * byte-identical specs -> identical content_hash).
 */
export function contentHash(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`
}
