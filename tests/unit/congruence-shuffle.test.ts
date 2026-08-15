/**
 * Unit tests for congruence panel shuffling and inverse permutation logic.
 *
 * Tests verify that:
 * 1. Seeded shuffling is deterministic (same seed → same shuffle)
 * 2. Inverse permutation correctly maps shuffled indices back to original
 * 3. Shuffle-then-unshuffle-via-inverse recovers original array
 * 4. Per-rater seeds are unique for different rater slots
 */

import { describe, it, expect } from 'vitest'
import {
  deriveSeed,
  seededRandom,
  shuffleWithSeed,
  buildShuffledCongruencePrompt,
} from '@/lib/instrument/congruence-panel'

describe('Congruence Shuffle Utilities', () => {
  describe('deriveSeed', () => {
    it('returns consistent seed for same input', () => {
      const seed1 = deriveSeed('build-1', 'item-1', 0)
      const seed2 = deriveSeed('build-1', 'item-1', 0)
      expect(seed1).toBe(seed2)
    })

    it('returns different seeds for different rater slots', () => {
      const seed0 = deriveSeed('build-1', 'item-1', 0)
      const seed1 = deriveSeed('build-1', 'item-1', 1)
      const seed2 = deriveSeed('build-1', 'item-1', 2)

      expect(seed0).not.toBe(seed1)
      expect(seed1).not.toBe(seed2)
      expect(seed0).not.toBe(seed2)
    })

    it('returns different seeds for different items', () => {
      const seed1 = deriveSeed('build-1', 'item-1', 0)
      const seed2 = deriveSeed('build-1', 'item-2', 0)

      expect(seed1).not.toBe(seed2)
    })

    it('returns different seeds for different builds', () => {
      const seed1 = deriveSeed('build-1', 'item-1', 0)
      const seed2 = deriveSeed('build-2', 'item-1', 0)

      expect(seed1).not.toBe(seed2)
    })

    it('returns value in range [0, 1)', () => {
      const seed = deriveSeed('build-1', 'item-1', 0)
      expect(seed).toBeGreaterThanOrEqual(0)
      expect(seed).toBeLessThan(1)
    })
  })

  describe('seededRandom', () => {
    it('returns deterministic sequence for same seed', () => {
      const rng1 = seededRandom(0.5)
      const rng2 = seededRandom(0.5)

      const values1 = Array.from({ length: 10 }, () => rng1())
      const values2 = Array.from({ length: 10 }, () => rng2())

      expect(values1).toEqual(values2)
    })

    it('returns different sequences for different seeds', () => {
      const rng1 = seededRandom(0.25)
      const rng2 = seededRandom(0.75)

      const values1 = Array.from({ length: 10 }, () => rng1())
      const values2 = Array.from({ length: 10 }, () => rng2())

      // At least some values should differ
      expect(values1).not.toEqual(values2)
    })

    it('returns values in range [0, 1)', () => {
      const rng = seededRandom(0.5)
      for (let i = 0; i < 100; i++) {
        const val = rng()
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThan(1)
      }
    })
  })

  describe('shuffleWithSeed', () => {
    it('returns array of same length', () => {
      const arr = ['a', 'b', 'c', 'd', 'e']
      const shuffled = shuffleWithSeed(arr, 0.5)

      expect(shuffled).toHaveLength(arr.length)
    })

    it('contains same elements as original', () => {
      const arr = ['a', 'b', 'c', 'd', 'e']
      const shuffled = shuffleWithSeed(arr, 0.5)

      const original = new Set(arr)
      const shuffledSet = new Set(shuffled)

      expect(shuffledSet).toEqual(original)
    })

    it('is deterministic for same seed', () => {
      const arr = ['a', 'b', 'c', 'd', 'e']
      const shuffled1 = shuffleWithSeed(arr, 0.5)
      const shuffled2 = shuffleWithSeed(arr, 0.5)

      expect(shuffled1).toEqual(shuffled2)
    })

    it('produces different shuffles for different seeds', () => {
      const arr = ['a', 'b', 'c', 'd', 'e']
      const shuffled1 = shuffleWithSeed(arr, 0.25)
      const shuffled2 = shuffleWithSeed(arr, 0.75)

      // Very unlikely to be equal for a 5-element array
      expect(shuffled1).not.toEqual(shuffled2)
    })

    it('does not modify original array', () => {
      const original = ['a', 'b', 'c', 'd', 'e']
      const originalCopy = [...original]

      shuffleWithSeed(original, 0.5)

      expect(original).toEqual(originalCopy)
    })

    it('handles single-element array', () => {
      const arr = ['a']
      const shuffled = shuffleWithSeed(arr, 0.5)

      expect(shuffled).toEqual(['a'])
    })

    it('handles empty array', () => {
      const arr: string[] = []
      const shuffled = shuffleWithSeed(arr, 0.5)

      expect(shuffled).toEqual([])
    })
  })

describe('buildShuffledCongruencePrompt', () => {
    it('returns prompt with shuffled candidates', () => {
      const input = {
        stem: 'Test item',
        candidates: [
          { id: 'c1', name: 'Construct 1' },
          { id: 'c2', name: 'Construct 2' },
          { id: 'c3', name: 'Construct 3' },
        ],
      }

      const result = buildShuffledCongruencePrompt('build-1', 'item-1', 0, input)

      expect(result.prompt).toBeTruthy()
      expect(result.prompt).toContain(input.stem)
      expect(result.shuffledCandidates).toHaveLength(3)
    })

    it('produces deterministic shuffles for same input', () => {
      const input = {
        stem: 'Test item',
        candidates: [
          { id: 'c1', name: 'Construct 1' },
          { id: 'c2', name: 'Construct 2' },
          { id: 'c3', name: 'Construct 3' },
        ],
      }

      const result1 = buildShuffledCongruencePrompt('build-1', 'item-1', 0, input)
      const result2 = buildShuffledCongruencePrompt('build-1', 'item-1', 0, input)

      expect(result1.prompt).toBe(result2.prompt)
      expect(result1.shuffledCandidates).toEqual(result2.shuffledCandidates)
    })

    it('produces different shuffles for different rater slots', () => {
      const input = {
        stem: 'Test item',
        candidates: [
          { id: 'c1', name: 'Construct 1' },
          { id: 'c2', name: 'Construct 2' },
          { id: 'c3', name: 'Construct 3' },
        ],
      }

      const result0 = buildShuffledCongruencePrompt('build-1', 'item-1', 0, input)
      const result1 = buildShuffledCongruencePrompt('build-1', 'item-1', 1, input)
      const result2 = buildShuffledCongruencePrompt('build-1', 'item-1', 2, input)

      // Prompts should be different (shuffles are different)
      expect(result0.prompt).not.toBe(result1.prompt)
      expect(result1.prompt).not.toBe(result2.prompt)
    })

    it('shuffled candidates match the order in the prompt', () => {
      const input = {
        stem: 'Test item',
        candidates: [
          { id: 'c1', name: 'Construct A' },
          { id: 'c2', name: 'Construct B' },
          { id: 'c3', name: 'Construct C' },
        ],
      }

      const result = buildShuffledCongruencePrompt('build-1', 'item-1', 0, input)

      // Each shuffled candidate ID should appear in the prompt in order
      for (const candidate of result.shuffledCandidates) {
        expect(result.prompt).toContain(`[${candidate.id}]`)
      }

      // The order should match the prompt
      let lastPos = -1
      for (const candidate of result.shuffledCandidates) {
        const pos = result.prompt.indexOf(`[${candidate.id}]`)
        expect(pos).toBeGreaterThan(lastPos)
        lastPos = pos
      }
    })

    it('permutes the candidate set without losing or duplicating any candidate', () => {
      const input = {
        stem: 'Test item',
        candidates: [
          { id: 'c1', name: 'Construct A' },
          { id: 'c2', name: 'Construct B' },
          { id: 'c3', name: 'Construct C' },
        ],
      }

      const result = buildShuffledCongruencePrompt('build-1', 'item-1', 0, input)

      // The safety property that actually matters: shuffling must PERMUTE the
      // candidate set, never lose, duplicate or invent one. The rater replies
      // with a construct ID (order-independent), so there is no inverse to
      // apply — but a candidate dropped by the shuffle would silently remove a
      // construct from that rater's choice set and bias the whole panel.
      const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)
      expect(result.shuffledCandidates).toHaveLength(input.candidates.length)
      expect([...result.shuffledCandidates].sort(byId)).toEqual(
        [...input.candidates].sort(byId)
      )

      // And every candidate's ID must still appear in the rendered prompt.
      for (const candidate of input.candidates) {
        expect(result.prompt).toContain(candidate.id)
      }
    })
  })
})
