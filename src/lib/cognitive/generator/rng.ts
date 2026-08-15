/**
 * Seeded, deterministic PRNG for the figural-matrix generator.
 *
 * Doc 03 (item-generation-pipeline) §3.6 specifies `pure-rand`'s
 * xoroshiro128plus with named substreams derived by `jump()`. That package
 * is not a dependency of this repo (`node_modules/pure-rand` does not
 * exist) and this task's constraints rule out touching `package.json` /
 * `package-lock.json` while another agent is concurrently landing LR-3 on
 * the same working tree — a lockfile edit is exactly the kind of change
 * that collides across concurrent agents.
 *
 * DEVIATION (reported in the LR-7 writeup): this module hand-rolls a
 * mulberry32 generator seeded by an FNV-1a 32-bit hash of a path string,
 * instead of xoroshiro128plus. It satisfies every property the doc actually
 * requires of the PRNG for this pipeline's purposes:
 *   - Deterministic: same seed string -> same output sequence, always.
 *   - No `Math.random()`, no `Date.now()`, no modulo-biased sampling
 *     (`int()` below uses rejection sampling, not `% range`).
 *   - Independent-enough substreams: `sub(name)` reseeds from
 *     `fnv1a32(path + '/' + name)`, a fresh hash rather than a shared
 *     counter, so consuming randomness on one substream never perturbs
 *     another's sequence. It is not proven statistically independent the
 *     way a true xoroshiro128plus jump is, but nothing in this pipeline
 *     depends on that stronger guarantee — only on reproducibility and
 *     stream isolation, both of which hold.
 * If `pure-rand` is later added as a real dependency (its own PR), this
 * module's public `Rng` interface is the seam: swap the implementation,
 * keep the interface, and every caller (compose.ts, distractors.ts,
 * families/*) is unaffected.
 */

export interface Rng {
  /** Next float in [0, 1). */
  next(): number
  /** Uniform integer in [min, max], inclusive both ends. Rejection-sampled — never `% range`. */
  int(min: number, max: number): number
  pick<T>(xs: readonly T[]): T
  /** Fisher-Yates shuffle. Does not mutate the input. */
  shuffle<T>(xs: readonly T[]): T[]
  /** A fresh, independently-seeded child stream. Deterministic given (this stream's path, name). */
  sub(name: string): Rng
}

/** 32-bit FNV-1a. Stable across platforms; used only to turn a path string into a PRNG seed. */
function fnv1a32(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: small, fast, deterministic 32-bit PRNG. Public domain construction. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeRngFromPath(path: string): Rng {
  const draw = mulberry32(fnv1a32(path))
  const self: Rng = {
    next() {
      return draw()
    },
    int(min, max) {
      if (max < min) throw new RangeError(`int(${min}, ${max}): max < min`)
      const range = max - min + 1
      // Rejection sampling against a power-of-two ceiling avoids modulo bias.
      const limit = Math.floor(0x100000000 / range) * range
      let x = Math.floor(draw() * 0x100000000)
      while (x >= limit) x = Math.floor(draw() * 0x100000000)
      return min + (x % range)
    },
    pick(xs) {
      if (xs.length === 0) throw new RangeError('pick: empty array')
      return xs[self.int(0, xs.length - 1)]
    },
    shuffle(xs) {
      const out = xs.slice()
      for (let i = out.length - 1; i > 0; i--) {
        const j = self.int(0, i)
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    },
    sub(name) {
      return makeRngFromPath(`${path}/${name}`)
    },
  }
  return self
}

/** Root entry point. `seed` is any string — the generation run's seed. */
export function makeRng(seed: string): Rng {
  return makeRngFromPath(`lrm-generator/v1/${seed}`)
}
