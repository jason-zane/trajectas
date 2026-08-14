import { describe, it, expect, vi } from 'vitest'
import { makeRng } from '@/lib/cognitive/generator/rng'

describe('generator/rng — determinism', () => {
  it('same seed produces the same sequence of draws', () => {
    const a = makeRng('seed-A')
    const b = makeRng('seed-A')
    const drawsA = Array.from({ length: 20 }, () => a.int(0, 1000))
    const drawsB = Array.from({ length: 20 }, () => b.int(0, 1000))
    expect(drawsA).toEqual(drawsB)
  })

  it('different seeds produce different sequences', () => {
    const a = makeRng('seed-A')
    const b = makeRng('seed-B')
    const drawsA = Array.from({ length: 20 }, () => a.int(0, 1_000_000))
    const drawsB = Array.from({ length: 20 }, () => b.int(0, 1_000_000))
    expect(drawsA).not.toEqual(drawsB)
  })

  it('substreams are deterministic and independent of draw order on other substreams', () => {
    const root1 = makeRng('seed-C')
    const sub1a = root1.sub('incidentals')
    const drawsSub1a = Array.from({ length: 10 }, () => sub1a.int(0, 100))

    // Fresh root, but this time draw from the ROOT before touching the substream.
    const root2 = makeRng('seed-C')
    root2.int(0, 100) // consume some of the root stream
    root2.int(0, 100)
    const sub2a = root2.sub('incidentals')
    const drawsSub2a = Array.from({ length: 10 }, () => sub2a.int(0, 100))

    expect(drawsSub1a).toEqual(drawsSub2a)
  })

  it('int() stays within [min, max] inclusive across many draws', () => {
    const rng = makeRng('range-check')
    for (let i = 0; i < 500; i++) {
      const v = rng.int(3, 7)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(7)
    }
  })

  it('shuffle is a permutation (same multiset, does not mutate input)', () => {
    const rng = makeRng('shuffle-check')
    const input = [1, 2, 3, 4, 5]
    const out = rng.shuffle(input)
    expect(input).toEqual([1, 2, 3, 4, 5]) // unmutated
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('never calls Math.random (spy-verified)', () => {
    const spy = vi.spyOn(Math, 'random')
    const rng = makeRng('no-math-random')
    rng.int(0, 100)
    rng.pick([1, 2, 3])
    rng.shuffle([1, 2, 3])
    rng.sub('x').int(0, 10)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
