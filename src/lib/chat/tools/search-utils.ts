import 'server-only'

/** Every resolver tool caps its result set at this many rows. */
export const SEARCH_LIMIT = 20

/**
 * Neutralise LIKE wildcards in user-supplied search text so a query of "100%"
 * matches the literal string rather than everything. Backslash-escapes are
 * what Postgres' ILIKE understands by default.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/**
 * PostgREST's `or=` filter is comma-separated, so a comma or parenthesis in a
 * search term would otherwise be read as filter syntax rather than as data.
 */
export function sanitiseOrTerm(value: string): string {
  return value.replace(/[,()]/g, ' ')
}
