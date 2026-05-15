import { describe, expect, it } from 'vitest'

import {
  computeDifficultyDistribution,
  selectItemsByDifficulty,
  type SelectableItem,
} from '@/lib/item-selection/distribution'
import type { ItemDifficulty } from '@/types/database'

type TestItem = SelectableItem & { id: string }

function item(
  id: string,
  difficulty: ItemDifficulty,
  reverse = false,
  displayOrder = 0,
): TestItem {
  return { id, difficulty, reverseScored: reverse, displayOrder }
}

describe('computeDifficultyDistribution', () => {
  it('returns zero distribution for non-positive N', () => {
    expect(computeDifficultyDistribution(0)).toEqual({ easy: 0, medium: 0, hard: 0 })
    expect(computeDifficultyDistribution(-3)).toEqual({ easy: 0, medium: 0, hard: 0 })
  })

  it('matches the canonical table', () => {
    const expected: Array<[number, [number, number, number]]> = [
      [1, [1, 0, 0]],
      [2, [1, 0, 1]],
      [3, [1, 1, 1]],
      [4, [2, 0, 2]],
      [5, [2, 1, 2]],
      [6, [2, 2, 2]],
      [7, [3, 1, 3]],
      [8, [3, 2, 3]], // user's worked example
      [9, [3, 3, 3]],
      [10, [4, 2, 4]],
      [11, [4, 3, 4]],
      [12, [4, 4, 4]],
      [15, [5, 5, 5]],
      [20, [7, 6, 7]],
    ]
    for (const [n, [easy, medium, hard]] of expected) {
      expect(computeDifficultyDistribution(n), `N=${n}`).toEqual({ easy, medium, hard })
    }
  })

  it('always sums back to N', () => {
    for (let n = 1; n <= 30; n++) {
      const d = computeDifficultyDistribution(n)
      expect(d.easy + d.medium + d.hard, `N=${n}`).toBe(n)
    }
  })
})

describe('selectItemsByDifficulty', () => {
  it('returns nothing when targetN ≤ 0', () => {
    const pool: TestItem[] = [item('a', 'easy')]
    expect(selectItemsByDifficulty(pool, 0)).toEqual([])
    expect(selectItemsByDifficulty(pool, -2)).toEqual([])
  })

  it('returns nothing when pool is empty', () => {
    expect(selectItemsByDifficulty([] as TestItem[], 6)).toEqual([])
  })

  it('respects the easy/medium/hard split when supply is healthy', () => {
    // 20-item pool, plenty in each band, no reverse-coded available so the
    // floor degrades to 0 and we test the pure distribution.
    const pool: TestItem[] = []
    let i = 0
    for (const band of ['easy', 'medium', 'hard'] as ItemDifficulty[]) {
      for (let n = 0; n < 5; n++) pool.push(item(`${band}-${n}`, band, false, i++))
    }

    const picked = selectItemsByDifficulty(pool, 6, { reverseRatio: 0 })
    const counts = countByBand(picked)
    expect(counts).toEqual({ easy: 2, medium: 2, hard: 2 })
  })

  it('drops a medium when N forces an uneven split (8 → 3/2/3)', () => {
    const pool = makeBalancedPool({ easy: 5, medium: 5, hard: 5 })
    const picked = selectItemsByDifficulty(pool, 8, { reverseRatio: 0 })
    expect(countByBand(picked)).toEqual({ easy: 3, medium: 2, hard: 3 })
  })

  it('biases extras to extremes for r=1 (10 → 4/2/4)', () => {
    const pool = makeBalancedPool({ easy: 5, medium: 5, hard: 5 })
    const picked = selectItemsByDifficulty(pool, 10, { reverseRatio: 0 })
    expect(countByBand(picked)).toEqual({ easy: 4, medium: 2, hard: 4 })
  })

  it('borrows from neighbouring bands when one is short', () => {
    // Want 6 (2/2/2) but only one easy and one medium are available;
    // shortfall must be backfilled from hard.
    const pool: TestItem[] = [
      item('e1', 'easy'),
      item('m1', 'medium'),
      item('h1', 'hard'),
      item('h2', 'hard'),
      item('h3', 'hard'),
      item('h4', 'hard'),
    ]
    const picked = selectItemsByDifficulty(pool, 6, { reverseRatio: 0 })
    expect(picked.length).toBe(6)
    const counts = countByBand(picked)
    expect(counts.easy).toBe(1)
    expect(counts.medium).toBe(1)
    expect(counts.hard).toBe(4)
  })

  it('returns as many as it can if the pool is smaller than the target', () => {
    const pool: TestItem[] = [item('e', 'easy'), item('m', 'medium')]
    const picked = selectItemsByDifficulty(pool, 6, { reverseRatio: 0 })
    expect(picked.length).toBe(2)
  })

  it('hits the 25 % reverse-coded floor when supply allows', () => {
    // Want N=8 → ceil(8 * 0.25) = 2 reverse-coded items minimum.
    const pool: TestItem[] = []
    let i = 0
    for (const band of ['easy', 'medium', 'hard'] as ItemDifficulty[]) {
      for (let n = 0; n < 4; n++) {
        pool.push(item(`${band}-${n}`, band, n < 2, i++))
      }
    }

    const picked = selectItemsByDifficulty(pool, 8)
    expect(picked.length).toBe(8)
    const reverseCount = picked.filter((p) => p.reverseScored === true).length
    expect(reverseCount).toBeGreaterThanOrEqual(2)
    expect(countByBand(picked)).toEqual({ easy: 3, medium: 2, hard: 3 })
  })

  it('falls back gracefully when not enough reverse-coded items exist', () => {
    // Only one reverse-coded item in the whole pool — floor should silently
    // clamp to what's available rather than throwing.
    const pool: TestItem[] = [
      item('e1', 'easy', true), // the only reverse-coded item
      item('e2', 'easy'),
      item('m1', 'medium'),
      item('m2', 'medium'),
      item('h1', 'hard'),
      item('h2', 'hard'),
    ]
    const picked = selectItemsByDifficulty(pool, 6)
    expect(picked.length).toBe(6)
    expect(picked.filter((p) => p.reverseScored === true).length).toBe(1)
  })

  it('respects display_order within a band as the tiebreaker', () => {
    // Two easy items, both eligible — the lower display_order wins.
    const pool: TestItem[] = [
      item('e-late', 'easy', false, 5),
      item('e-early', 'easy', false, 1),
      item('m1', 'medium'),
      item('h1', 'hard'),
    ]
    const picked = selectItemsByDifficulty(pool, 3, { reverseRatio: 0 })
    const ids = picked.map((p) => p.id).sort()
    expect(ids).toEqual(['e-early', 'h1', 'm1'])
  })

  it('treats missing difficulty as medium (legacy items)', () => {
    // No `difficulty` set at all — bucketed into medium so selection still works.
    const pool: TestItem[] = [
      { reverseScored: false, displayOrder: 0 } as TestItem,
      { reverseScored: false, displayOrder: 1 } as TestItem,
      { reverseScored: false, displayOrder: 2 } as TestItem,
    ]
    const picked = selectItemsByDifficulty(pool, 2, { reverseRatio: 0 })
    expect(picked.length).toBe(2)
  })

  it('accepts snake_case row shapes from the database', () => {
    const pool: TestItem[] = [
      { difficulty: 'easy', reverse_scored: true, display_order: 0 } as TestItem,
      { difficulty: 'medium', reverse_scored: false, display_order: 0 } as TestItem,
      { difficulty: 'hard', reverse_scored: false, display_order: 0 } as TestItem,
    ]
    const picked = selectItemsByDifficulty(pool, 3)
    expect(picked.length).toBe(3)
  })
})

function countByBand(items: TestItem[]): Record<ItemDifficulty, number> {
  const out: Record<ItemDifficulty, number> = { easy: 0, medium: 0, hard: 0 }
  for (const it of items) out[(it.difficulty ?? 'medium') as ItemDifficulty]++
  return out
}

function makeBalancedPool(counts: Record<ItemDifficulty, number>): TestItem[] {
  const pool: TestItem[] = []
  let order = 0
  for (const band of ['easy', 'medium', 'hard'] as ItemDifficulty[]) {
    for (let n = 0; n < counts[band]; n++) {
      pool.push(item(`${band}-${n}`, band, false, order++))
    }
  }
  return pool
}
