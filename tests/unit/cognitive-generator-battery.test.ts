import { describe, it, expect } from 'vitest'
import { generateBatch } from '@/lib/cognitive/generator'
import { ALL_FAMILIES } from '@/lib/cognitive/generator/families'
import { FiguralMatrixItemSpec, CognitiveOptionSpec } from '@/lib/cognitive/spec/schema'
import { toRenderSpec } from '@/lib/cognitive/spec/project'
import { renderMatrixGrid, renderOptionTile } from '@/lib/cognitive/render/matrix-svg'
import { batchBlindHitRate } from '@/lib/cognitive/generator/qa/contextblind'

const PER_FAMILY = 8

describe('generator — full pilot-scale batch (9 families x 8 = up to 72 items)', () => {
  const result = generateBatch(ALL_FAMILIES, 'pilot-battery-seed', PER_FAMILY)

  it('produces a representative pilot bank (>=60% acceptance)', () => {
    const attempted = Object.values(result.attempted).reduce((s, n) => s + n, 0)
    expect(result.items.length).toBeGreaterThan(attempted * 0.6)
  })

  it('every ACCEPTED item passes all 17 QA gates (none skipped-as-fail, none failed)', () => {
    for (const item of result.items) {
      for (const [gateId, entry] of Object.entries(item.qa.gates)) {
        expect(entry.status, `${item.familyCode}/${item.seed} gate ${gateId}`).not.toBe('fail')
      }
    }
  })

  it('every accepted item round-trips through the LR-4 zod schema and renderer', () => {
    for (const item of result.items) {
      // itemSpec/optionSpecs were already constructed via FiguralMatrixItemSpec.parse/
      // CognitiveOptionSpec.parse inside generateFamily — re-parse here as an
      // independent, explicit proof for this test file.
      const reparsedItem = FiguralMatrixItemSpec.parse(item.itemSpec)
      const reparsedOptions = item.optionSpecs.map((o) => CognitiveOptionSpec.parse(o))
      const rendered = toRenderSpec(reparsedItem, reparsedOptions)
      const gridSvg = renderMatrixGrid(rendered)
      expect(gridSvg).toContain('<svg')
      expect(gridSvg.match(/<svg/g)?.length).toBe(8) // 8 context cells
      for (const o of rendered.options) {
        const svg = renderOptionTile(o.elements, rendered.render)
        expect(svg).toContain('<svg')
      }
      // The rendered projection must never leak rules/radicals (answer-key isolation).
      expect(JSON.stringify(rendered)).not.toMatch(/"rules"|"radicals"/)
    }
  })

  it('key slots are balanced within +-1 across the whole batch (doc §9 rule 2 / gate G-16)', () => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 }
    for (const item of result.items) counts[item.keySlot]++
    const values = Object.values(counts)
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1)
  })

  it('G-08\'s guarantee holds in aggregate: batch-level blind-scorer hit COUNT is exactly 0 (see qa/contextblind.ts\'s G-17 finding for why doc\'s literal ~20%-of-chance interval is unreachable once G-08 is enforced per item)', () => {
    const blindItems = result.items.map((item) => {
      const keyIdx = item.optionSpecs.findIndex((o) => o.slot === item.keySlot)
      const family = ALL_FAMILIES.find((f) => f.code === item.familyCode)!
      return { options: item.optionSpecs.map((o) => ({ elements: o.elements })), keyIndex: keyIdx, axes: family.axes }
    })
    const rate = batchBlindHitRate(blindItems)
    expect(rate.hits).toBe(0)
    expect(rate.withinBinomialInterval).toBe(false) // documents the finding rather than hiding it
  })

  it('no duplicate content hashes across the whole batch (cross-family, not just within-family)', () => {
    const hashes = result.items.map((i) => i.qa.contentHash)
    expect(new Set(hashes).size).toBe(hashes.length)
  })

  it('reports per-family reject reasons for the ones that did not reach the target count (transparency, not silence)', () => {
    for (const code of Object.keys(result.attempted)) {
      const accepted = result.items.filter((i) => i.familyCode === code).length
      if (accepted < PER_FAMILY) {
        // Every shortfall must be explained by a tallied reject reason.
        const rejectTotal = Object.values(result.rejects[code] ?? {}).reduce((s, n) => s + n, 0)
        expect(accepted + rejectTotal).toBe(PER_FAMILY)
      }
    }
  })
})
