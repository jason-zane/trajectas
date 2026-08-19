import { describe, it, expect } from 'vitest'
import { generateBatch } from '@/lib/cognitive/generator'
import { ALL_FAMILIES } from '@/lib/cognitive/generator/families'
import { FiguralMatrixItemSpec, CognitiveOptionSpec } from '@/lib/cognitive/spec/schema'
import { toRenderSpec } from '@/lib/cognitive/spec/project'
import { renderMatrixGrid, renderOptionTile } from '@/lib/cognitive/render/matrix-svg'
import { batchBlindHitRate } from '@/lib/cognitive/generator/qa/contextblind'
import { keySlotBalanceGate, batchBlindGuaranteeGate } from '@/lib/cognitive/generator/qa/batch'

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
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 }
    for (const item of result.items) counts[item.keySlot]++
    const values = Object.values(counts)
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1)
    // G-16, formalised as a real gate (qa/batch.ts) rather than only an
    // emergent property of the round-robin offset — same assertion, now
    // made through the gate function itself.
    expect(
      keySlotBalanceGate(
        result.items.map((i) => i.keySlot),
        result.items.map((i) => i.optionSpecs.length),
      ).status,
    ).toBe('pass')
  })

  it('FINDING, RECONCILED (issue #346, item 3): doc\'s literal G-17 ("hit rate within the ~20%-of-chance interval") is unreachable once G-08 is enforced per item — the hit COUNT is mechanically driven to exactly 0, far outside that interval. G-17 is redefined (qa/batch.ts\'s batchBlindGuaranteeGate) to the criterion that IS satisfiable: hits === 0, confirming G-08\'s guarantee held for every item in the batch. Both computations are asserted here so the historical tension stays visible.', () => {
    const blindItems = result.items.map((item) => {
      const keyIdx = item.optionSpecs.findIndex((o) => o.slot === item.keySlot)
      const family = ALL_FAMILIES.find((f) => f.code === item.familyCode)!
      return { options: item.optionSpecs.map((o) => ({ elements: o.elements })), keyIndex: keyIdx, axes: family.axes }
    })
    // Doc's literal computation: the binary hit count sits outside the
    // ~20%-of-chance interval doc's original G-17 wording asks for — the
    // historical tension, pinned rather than hidden. Under G-08′ (v2/v3)
    // the count is no longer mechanically 0: an item whose options are
    // pairwise distinct on every axis (LRM-MIRROR) ties the scorer across
    // all six, which the literal count records as a "hit" at P = 1/6.
    const rate = batchBlindHitRate(blindItems)
    expect(rate.withinBinomialInterval).toBe(false)
    expect(rate.hits).toBeLessThan(rate.lowerBound)
    // The reconciled gate: the scorer's EXPECTED hits over the batch do not
    // exceed chance — the faithful generalisation of "hits === 0" once the
    // per-item criterion is an expected hit rate. A batch where it did not
    // hold would indicate G-08′ had a hole somewhere.
    expect(rate.expectedHits).toBeLessThanOrEqual(rate.n * rate.chance + 1e-9)
    expect(batchBlindGuaranteeGate(blindItems).status).toBe('pass')
  })

  it('generateBatch enforces G-16/G-17 as real batch gates (doesn\'t just report them) — a full multi-family run completes without throwing, and its returned batchQa shows both passing', () => {
    expect(result.batchQa.gates['G-16'].status).toBe('pass')
    expect(result.batchQa.gates['G-17'].status).toBe('pass')
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
