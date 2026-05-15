/**
 * Item selection — even difficulty distribution with a reverse-coded floor.
 *
 * Rules (see AGENTS.md / migration 20260515120000_item_difficulty.sql):
 *
 * 1. Items carry a `difficulty` band: easy / medium / hard.
 * 2. When picking N items per construct, distribute evenly across the three
 *    bands. For N divisible by 3 it's a clean third each. For an uneven N,
 *    extras go to the *extremes* (easy and hard) — mediums are dropped first
 *    so the spread stays as wide as possible.
 *      N=1  → 1/0/0
 *      N=2  → 1/0/1
 *      N=3  → 1/1/1
 *      N=4  → 2/0/2
 *      N=5  → 2/1/2
 *      N=6  → 2/2/2
 *      N=7  → 3/1/3
 *      N=8  → 3/2/3
 *      N=10 → 4/2/4
 *      N=12 → 4/4/4
 * 3. At least 25% (rounded up) of the selected items must be reverse-coded.
 * 4. If a band is undersupplied, the shortfall is borrowed from the closest
 *    other band so the construct still gets N items if at all possible.
 */

import type { ItemDifficulty } from '@/types/database'

export type DifficultyDistribution = Record<ItemDifficulty, number>

/** Minimum item type used by the distribution helpers. */
export type SelectableItem = {
  difficulty?: ItemDifficulty | null
  reverseScored?: boolean | null
  selectionPriority?: number | null
  displayOrder?: number | null
  // Snake-case mirrors so callers can pass DB rows untouched.
  reverse_scored?: boolean | null
  selection_priority?: number | null
  display_order?: number | null
}

/** Default reverse-coded floor: at least 25% of the selected items. */
export const DEFAULT_REVERSE_RATIO = 0.25

/**
 * Compute the target count of items per difficulty band.
 *
 * Extras (when N is not divisible by 3) bias to easy first, then hard, so
 * mediums are the first thing dropped.
 */
export function computeDifficultyDistribution(n: number): DifficultyDistribution {
  if (!Number.isFinite(n) || n <= 0) {
    return { easy: 0, medium: 0, hard: 0 }
  }

  const target = Math.floor(n)
  const base = Math.floor(target / 3)
  const remainder = target - base * 3
  // r=0 → base/base/base                    (perfect thirds)
  // r=1 → base+1 / base-1 / base+1          (drop a medium, push extras out — net +1)
  //       fallback when base=0 and N=1: 1/0/0
  // r=2 → base+1 / base / base+1            (extras go to easy and hard, never medium)
  if (remainder === 0) {
    return { easy: base, medium: base, hard: base }
  }
  if (remainder === 2) {
    return { easy: base + 1, medium: base, hard: base + 1 }
  }
  // remainder === 1
  if (base === 0) {
    return { easy: 1, medium: 0, hard: 0 }
  }
  return { easy: base + 1, medium: base - 1, hard: base + 1 }
}

function bandOf(item: SelectableItem): ItemDifficulty {
  return (item.difficulty ?? 'medium') as ItemDifficulty
}

function isReverse(item: SelectableItem): boolean {
  return Boolean(item.reverseScored ?? item.reverse_scored ?? false)
}

function priority(item: SelectableItem): number {
  return Number(item.selectionPriority ?? item.selection_priority ?? 0)
}

function order(item: SelectableItem): number {
  return Number(item.displayOrder ?? item.display_order ?? 0)
}

/**
 * Sort comparator: lower selection_priority first, then lower display_order,
 * with reverse-coded items breaking ties so they bubble up when otherwise equal.
 */
function compareItems(a: SelectableItem, b: SelectableItem): number {
  const p = priority(a) - priority(b)
  if (p !== 0) return p
  const o = order(a) - order(b)
  if (o !== 0) return o
  return Number(isReverse(b)) - Number(isReverse(a))
}

/**
 * Pick `targetN` items for a single construct, distributing across difficulty
 * bands and meeting a reverse-coded floor. If the pool is short, returns as
 * many as it can (caller surfaces shortfall separately).
 */
export function selectItemsByDifficulty<T extends SelectableItem>(
  items: T[],
  targetN: number,
  options: { reverseRatio?: number } = {},
): T[] {
  if (targetN <= 0 || items.length === 0) return []

  const reverseRatio = options.reverseRatio ?? DEFAULT_REVERSE_RATIO
  const reverseFloor = Math.min(
    Math.ceil(targetN * reverseRatio),
    items.filter(isReverse).length,
  )

  // Bucket items by difficulty band.
  const buckets: Record<ItemDifficulty, T[]> = { easy: [], medium: [], hard: [] }
  for (const it of items) buckets[bandOf(it)].push(it)
  for (const band of ['easy', 'medium', 'hard'] as ItemDifficulty[]) {
    buckets[band].sort(compareItems)
  }

  const distribution = computeDifficultyDistribution(targetN)

  // Step 1 — pick items per band up to the desired count, preferring reverse-coded
  // entries until we've met the reverse floor.
  const picked = new Set<T>()
  let reverseCount = 0
  const counts: DifficultyDistribution = { easy: 0, medium: 0, hard: 0 }

  function take(item: T, band: ItemDifficulty): void {
    picked.add(item)
    counts[band]++
    if (isReverse(item)) reverseCount++
  }

  function pickFromBand(band: ItemDifficulty, want: number): void {
    if (want <= 0) return
    const pool = buckets[band]
    const reverseNeeded = Math.max(0, reverseFloor - reverseCount)
    let taken = 0

    if (reverseNeeded > 0) {
      for (const item of pool) {
        if (picked.has(item)) continue
        if (!isReverse(item)) continue
        take(item, band)
        taken++
        if (taken >= want) return
        if (reverseCount >= reverseFloor) break
      }
    }

    for (const item of pool) {
      if (picked.has(item)) continue
      take(item, band)
      taken++
      if (taken >= want) return
    }
  }

  for (const band of ['easy', 'medium', 'hard'] as ItemDifficulty[]) {
    pickFromBand(band, distribution[band])
  }

  // Step 2 — borrow from neighbouring bands if any band came up short.
  const borrowOrder: Record<ItemDifficulty, ItemDifficulty[]> = {
    easy: ['medium', 'hard'],
    medium: ['easy', 'hard'],
    hard: ['medium', 'easy'],
  }
  for (const band of ['easy', 'medium', 'hard'] as ItemDifficulty[]) {
    let shortfall = distribution[band] - counts[band]
    if (shortfall <= 0) continue
    for (const donor of borrowOrder[band]) {
      if (shortfall <= 0) break
      for (const item of buckets[donor]) {
        if (picked.has(item)) continue
        take(item, donor)
        shortfall--
        if (shortfall <= 0) break
      }
    }
  }

  // Step 3 — if we still need to hit the reverse floor, swap a non-reverse pick
  // for an unused reverse-coded candidate (any band).
  if (reverseCount < reverseFloor) {
    const unusedReverse = items.filter((it) => !picked.has(it) && isReverse(it))
    unusedReverse.sort(compareItems)
    const replaceable = [...picked].filter((it) => !isReverse(it))
    replaceable.sort((a, b) => -compareItems(a, b)) // worst first
    while (reverseCount < reverseFloor && unusedReverse.length > 0 && replaceable.length > 0) {
      const drop = replaceable.pop()!
      const add = unusedReverse.shift()!
      picked.delete(drop)
      counts[bandOf(drop)]--
      picked.add(add)
      counts[bandOf(add)]++
      reverseCount++
    }
  }

  // Preserve original input ordering for the returned slice — call sites that
  // care about presentation order will re-sort, but this keeps the output
  // predictable for tests.
  return items.filter((it) => picked.has(it))
}
