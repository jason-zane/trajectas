/**
 * Section item ordering — applies the `item_ordering` mode chosen per section
 * to the items being delivered to the runner.
 *
 * Seeded by the session id so that the order is stable across refreshes within
 * a single sitting but fresh for every new session (i.e. every time the
 * assessment is taken).
 */

import type { ItemOrdering } from '@/types/database'

type ConstructBearing = { construct_id?: string | null; items?: { construct_id?: string | null } | null }

function hashStringToUint32(seed: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seededShuffle<T>(items: readonly T[], rng: () => number): T[] {
  const arr = items.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function interleaveByConstruct<T extends ConstructBearing>(items: readonly T[], rng: () => number): T[] {
  const buckets = new Map<string, T[]>()
  const order: string[] = []
  for (const item of items) {
    const key = item.construct_id ?? item.items?.construct_id ?? '__no_construct__'
    if (!buckets.has(key)) {
      buckets.set(key, [])
      order.push(key)
    }
    buckets.get(key)!.push(item)
  }

  // Shuffle within each bucket so item position inside a construct is also
  // randomised. Bucket iteration order is randomised too so the first item
  // isn't always from the same construct.
  for (const key of order) {
    buckets.set(key, seededShuffle(buckets.get(key)!, rng))
  }
  const shuffledKeys = seededShuffle(order, rng)

  const out: T[] = []
  let added = true
  while (added) {
    added = false
    for (const key of shuffledKeys) {
      const b = buckets.get(key)!
      const next = b.shift()
      if (next) {
        out.push(next)
        added = true
      }
    }
  }
  return out
}

export function applyItemOrdering<T extends ConstructBearing>(
  items: readonly T[],
  ordering: ItemOrdering | string,
  seed: string,
): T[] {
  if (items.length <= 1) return items.slice()
  const rng = mulberry32(hashStringToUint32(seed))
  switch (ordering) {
    case 'fixed':
      return items.slice()
    case 'interleaved_by_construct':
      return interleaveByConstruct(items, rng)
    case 'randomised':
    default:
      return seededShuffle(items, rng)
  }
}
