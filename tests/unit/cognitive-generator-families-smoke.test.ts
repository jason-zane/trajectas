import { describe, it, expect } from 'vitest'
import { generateFamily } from '@/lib/cognitive/generator'
import { LRM_PROG_COUNT } from '@/lib/cognitive/generator/families/lrm-prog-count'
import { LRM_ROT } from '@/lib/cognitive/generator/families/lrm-rot'
import { LRM_DIST3X2 } from '@/lib/cognitive/generator/families/lrm-dist3x2'
import { LRM_ADD } from '@/lib/cognitive/generator/families/lrm-add'
import { LRM_SUB } from '@/lib/cognitive/generator/families/lrm-sub'
import { LRM_2R_XLAYER } from '@/lib/cognitive/generator/families/lrm-2r-xlayer'
import { LRM_3R_DIST } from '@/lib/cognitive/generator/families/lrm-3r-dist'
import { LRM_XOR_XLAYER } from '@/lib/cognitive/generator/families/lrm-xor-xlayer'
import { LRM_MOVE } from '@/lib/cognitive/generator/families/lrm-move'
import { LRM_XOR_DIST_XLAYER } from '@/lib/cognitive/generator/families/lrm-xor-dist-xlayer'
import { LRM_3R_XLAYER } from '@/lib/cognitive/generator/families/lrm-3r-xlayer'
import { toRenderSpec } from '@/lib/cognitive/spec/project'
import { renderMatrixGrid, renderOptionTile } from '@/lib/cognitive/render/matrix-svg'
import type { FamilyTemplate } from '@/lib/cognitive/generator/compose'
import { composeItem } from '@/lib/cognitive/generator/compose'
import { makeRng } from '@/lib/cognitive/generator/rng'
import { ALL_FAMILIES } from '@/lib/cognitive/generator/families'

// LRM_DIST3X2 is absent from the registered set on purpose — it cannot
// satisfy G-11 for any parameter draw (proof in families/lrm-dist3x2.ts's
// header; the impossibility itself is pinned by the dedicated test below,
// so removing it from this list does not quietly drop it from coverage).
const FAMILIES: FamilyTemplate<unknown>[] = [LRM_PROG_COUNT, LRM_ROT, LRM_ADD, LRM_SUB, LRM_2R_XLAYER, LRM_3R_DIST, LRM_XOR_XLAYER, LRM_MOVE, LRM_XOR_DIST_XLAYER, LRM_3R_XLAYER].map((f) => f as FamilyTemplate<unknown>)

describe.each(FAMILIES.map((f) => [f.code, f] as const))('%s smoke test', (_code, family) => {
  it('generates at least half its requested items across a range of seeds', () => {
    let totalAccepted = 0
    let totalAttempted = 0
    for (let s = 0; s < 5; s++) {
      const result = generateFamily(family, `smoke-${s}`, 10)
      totalAccepted += result.items.length
      totalAttempted += result.attempted
      for (const item of result.items) {
        const rendered = toRenderSpec(item.itemSpec, item.optionSpecs)
        expect(renderMatrixGrid(rendered)).toContain('<svg')
        for (const o of rendered.options) {
          expect(renderOptionTile(o.elements, rendered.render)).toContain('<svg')
        }
      }
    }
    expect(totalAccepted).toBeGreaterThan(totalAttempted / 2)
  })

  it('is deterministic across repeated runs of the same seed', () => {
    const a = generateFamily(family, 'determinism-seed', 6)
    const b = generateFamily(family, 'determinism-seed', 6)
    expect(a.items.map((i) => i.qa.contentHash)).toEqual(b.items.map((i) => i.qa.contentHash))
    expect(a.rejects).toEqual(b.rejects)
  })
})

describe('LRM-DIST3X2 — unregistered, and provably unregisterable as built', () => {
  it('fails G-11 on every draw, and the reason is structural: two 3-valued axes give 9 distinguishable cells, the duplicate-free grid consumes all 9, so the key is the only option that can ever be a non-copy', () => {
    let accepted = 0
    let attempted = 0
    const rejects: Record<string, number> = {}
    for (let s = 0; s < 5; s++) {
      const result = generateFamily(LRM_DIST3X2, `dist3x2-impossibility-${s}`, 10)
      accepted += result.items.length
      attempted += result.attempted
      for (const [reason, n] of Object.entries(result.rejects)) rejects[reason] = (rejects[reason] ?? 0) + n
    }
    expect(accepted).toBe(0)
    expect(rejects).toEqual({ 'G-11': attempted })

    // The pigeonhole itself, checked directly rather than inferred from the
    // reject tally: the 8 visible cells plus the key realise 9 pairwise-
    // distinct (shape, fill) pairs, which is the entire value space, so no
    // tenth "novel" figure exists for a distractor to be built from.
    const rng = makeRng('dist3x2-pigeonhole')
    const composed = composeItem(LRM_DIST3X2, rng)
    const pairs = [...composed.grid.map((c) => c.elements), composed.keyCell.elements].map((els) => {
      const el = els[0]
      if (el.type !== 'shape') throw new Error('expected a shape element')
      return `${el.shape}|${el.fill}`
    })
    expect(pairs).toHaveLength(9)
    expect(new Set(pairs).size).toBe(9)
    const shapes = new Set(pairs.map((p) => p.split('|')[0]))
    const fills = new Set(pairs.map((p) => p.split('|')[1]))
    expect(shapes.size * fills.size).toBe(9) // 3 x 3 — the whole space, fully consumed
  })

  it('is not in the registered family set (registering it would add 0 items and 10 rejects per pilot run)', () => {
    expect(ALL_FAMILIES.map((f) => f.code)).not.toContain('LRM-DIST3X2')
  })
})
