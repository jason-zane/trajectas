/**
 * Small enumeration helper shared by families that repair a distractor set
 * by SEARCHING over which context cells to draw from, rather than deriving
 * a closed-form choice by hand (see the header comments in
 * families/lrm-dist3x2.ts, lrm-2r-xlayer.ts and lrm-sub.ts for why —
 * doc 03's own worked exemplars show this is sometimes unavoidable).
 */

/** All 4-element subsets of `xs` (element order preserved within each subset), in a fixed deterministic enumeration order. */
export function combinations4<T>(xs: readonly T[]): T[][] {
  const out: T[][] = []
  const n = xs.length
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++) out.push([xs[a], xs[b], xs[c], xs[d]])
  return out
}

/** All 5-element subsets of `xs` (element order preserved within each subset), in a fixed deterministic enumeration order. */
export function combinations5<T>(xs: readonly T[]): T[][] {
  const out: T[][] = []
  const n = xs.length
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) out.push([xs[a], xs[b], xs[c], xs[d], xs[e]])
  return out
}
