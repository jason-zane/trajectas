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

const FAMILIES: FamilyTemplate<unknown>[] = [LRM_PROG_COUNT, LRM_ROT, LRM_DIST3X2, LRM_ADD, LRM_SUB, LRM_2R_XLAYER, LRM_3R_DIST, LRM_XOR_XLAYER, LRM_MOVE, LRM_XOR_DIST_XLAYER, LRM_3R_XLAYER].map((f) => f as FamilyTemplate<unknown>)

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
