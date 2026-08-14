import { slugify as utilsSlugify } from '@/lib/utils'

/**
 * Normalize a string to a URL-safe slug.
 *
 * Re-exports the shared slugify helper from utils but adds a fallback
 * for empty results and a length cap (60 chars).
 *
 * For diacritics and punctuation stripping, the underlying implementation
 * uses regex on \w which may not strip accents on all platforms. If you need
 * reliable diacritic normalization, use NFD + filter. For now, this is
 * sufficient for English/Latin input.
 */
export function slugify(input: string): string {
  const slug = utilsSlugify(input)
  // If input produces an empty slug (e.g., "!!!"), fall back to 'untitled'
  if (!slug) return 'untitled'
  // Cap at 60 chars to keep URLs readable and avoid filesystem path limits
  return slug.slice(0, 60)
}

/**
 * Append a numeric suffix to a base slug until it does not appear in the taken set.
 *
 * Comparison is CASE-INSENSITIVE because the database column is citext.
 * Given base='foo' and taken=['foo', 'foo-2'], returns 'foo-3'.
 * If base is not in taken, returns base as-is.
 * Caps at 99 attempts to avoid infinite loops on malformed inputs.
 */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const takenLower = new Set<string>()
  for (const slug of taken) {
    takenLower.add(slug.toLowerCase())
  }

  const baseLower = base.toLowerCase()
  if (!takenLower.has(baseLower)) {
    return base
  }

  // Append -2, -3, ... until we find an unused slug
  for (let i = 2; i <= 100; i++) {
    const candidate = `${base}-${i}`
    if (!takenLower.has(candidate.toLowerCase())) {
      return candidate
    }
  }

  // Fallback: should never reach here in normal use
  return `${base}-${Date.now()}`
}
