/**
 * Bounded-concurrency helpers for engine stages that fan out to a provider.
 *
 * Stages like the congruence panel make one call per (item × rater). Run
 * sequentially that is O(items × raters) round trips — 100 items × 3 raters is
 * 300 sequential calls, which exceeds any reasonable request timeout. These
 * helpers run the work in parallel with a ceiling, so wall-clock scales with
 * `limit` rather than with the item count, while still bounding how hard we
 * hit the provider.
 *
 * Pure and I/O-free: the caller supplies the async work.
 */

/** Default parallelism for provider fan-out. Conservative enough to avoid rate limits. */
export const DEFAULT_CONCURRENCY = 6

/**
 * Map over `items` with at most `limit` tasks in flight.
 *
 * Results are returned in INPUT ORDER regardless of completion order — callers
 * rely on positional correspondence with the input.
 *
 * A task that rejects does not abort the run: its slot resolves to
 * `{ ok: false, error }` so partial progress survives one bad item.
 */
export async function mapWithConcurrency<In, Out>(
  items: In[],
  limit: number,
  worker: (item: In, index: number) => Promise<Out>,
): Promise<Array<{ ok: true; value: Out } | { ok: false; error: unknown }>> {
  const results = new Array<{ ok: true; value: Out } | { ok: false; error: unknown }>(
    items.length,
  )
  if (items.length === 0) return results

  const effectiveLimit = Math.max(1, Math.min(Math.floor(limit) || 1, items.length))
  let cursor = 0

  async function runner(): Promise<void> {
    for (;;) {
      const index = cursor++
      if (index >= items.length) return
      try {
        results[index] = { ok: true, value: await worker(items[index], index) }
      } catch (error) {
        results[index] = { ok: false, error }
      }
    }
  }

  await Promise.all(Array.from({ length: effectiveLimit }, () => runner()))
  return results
}

/** Split an array into fixed-size chunks. Used to persist progress incrementally. */
export function chunk<T>(items: T[], size: number): T[][] {
  const safeSize = Math.max(1, Math.floor(size) || 1)
  const out: T[][] = []
  for (let i = 0; i < items.length; i += safeSize) {
    out.push(items.slice(i, i + safeSize))
  }
  return out
}
