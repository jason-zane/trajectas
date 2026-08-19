/**
 * Per-family battery: generate N seeds × K draws for one family module and
 * print what a reviewer needs before registering it — accept rate, reject
 * reasons, the max expected blind hit rate over accepted items, predicted b,
 * option count, time per item, and (optionally) an HTML contact sheet.
 *
 *   node --import ./scripts/cognitive/register-ts-loader.mjs \
 *     scripts/cognitive/measure-family.ts src/lib/cognitive/generator/families/lrm-mirror.ts [seeds=20] [perSeed=8] [--html out.html]
 *
 * The module must export exactly one FamilyTemplate (an export whose value
 * has `code`, `axes`, `buildDistractors`). Nothing here writes to a database.
 */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { writeFileSync } from 'node:fs'
import { generateFamily } from '@/lib/cognitive/generator/index'
import type { FamilyTemplate } from '@/lib/cognitive/generator/compose'
import { modalHitRate } from '@/lib/cognitive/generator/qa/contextblind'
import { predictedB, band } from '@/lib/cognitive/generator/difficulty'
import { renderCellSvg } from '@/lib/cognitive/render/matrix-svg'

const [, , modulePath, seedsArg, perSeedArg, ...rest] = process.argv
if (!modulePath) {
  console.error('usage: measure-family.ts <family-module.ts> [seeds] [perSeed] [--html out.html]')
  process.exit(2)
}
const SEEDS = Number(seedsArg ?? 20)
const PER_SEED = Number(perSeedArg ?? 8)
const htmlIdx = rest.indexOf('--html')
const htmlOut = htmlIdx >= 0 ? rest[htmlIdx + 1] : null

const mod = (await import(pathToFileURL(resolve(modulePath)).href)) as Record<string, unknown>
const templates = Object.values(mod).filter(
  (v): v is FamilyTemplate<unknown> => !!v && typeof v === 'object' && 'code' in (v as object) && 'buildDistractors' in (v as object),
)
if (templates.length !== 1) {
  console.error(`expected exactly one FamilyTemplate export in ${modulePath}, found ${templates.length}`)
  process.exit(2)
}
const family = templates[0]

const rejects: Record<string, number> = {}
let attempted = 0
let accepted = 0
let maxPHit = 0
let sumPHit = 0
const optionCounts = new Set<number>()
const keySlots: Record<string, number> = {}
const contentHashes = new Set<string>()
const structuralHashes = new Set<string>()
const sampleSvgs: string[] = []
const bValues = new Set<number>()
let thrown: string | null = null

const t0 = performance.now()
for (let s = 0; s < SEEDS; s++) {
  const seed = `measure-${family.code}-${s}`
  try {
    const res = generateFamily(family, seed, PER_SEED, { existingContentHashes: contentHashes, existingStructuralHashes: structuralHashes })
    attempted += res.attempted
    for (const [reason, n] of Object.entries(res.rejects)) rejects[reason] = (rejects[reason] ?? 0) + n
    for (const item of res.items) {
      accepted++
      contentHashes.add(item.qa.contentHash)
      structuralHashes.add(item.qa.structuralHash)
      optionCounts.add(item.optionSpecs.length)
      keySlots[item.keySlot] = (keySlots[item.keySlot] ?? 0) + 1
      const keyIndex = item.optionSpecs.findIndex((o) => o.slot === item.keySlot)
      const { pHit } = modalHitRate(
        item.optionSpecs.map((o) => ({ elements: o.elements })),
        keyIndex,
        family.axes,
      )
      maxPHit = Math.max(maxPHit, pHit)
      sumPHit += pHit
      bValues.add(item.itemSpec.radicals ? predictedB(item.itemSpec.radicals, { nonCardinalAsymmetricRotation: false }) : NaN)
      if (htmlOut && sampleSvgs.length < 12) {
        const grid = [...item.itemSpec.grid.cells].sort((a, b) => a.row - b.row || a.col - b.col)
        const cells = grid.map((c) => `<div class="cell">${renderCellSvg(c.elements, item.itemSpec.render)}</div>`)
        cells.splice(8, 0, '<div class="cell blank">?</div>')
        const opts = item.optionSpecs
          .map((o) => `<div class="opt ${o.slot === item.keySlot ? 'key' : ''}">${renderCellSvg(o.elements, item.itemSpec.render)}<span>${o.slot}</span></div>`)
          .join('')
        sampleSvgs.push(`<section><h3>${family.code} · ${seed} · key ${item.keySlot}</h3><div class="grid">${cells.join('')}</div><div class="opts">${opts}</div></section>`)
      }
    }
  } catch (e) {
    thrown = `${(e as Error).name}: ${(e as Error).message}`.slice(0, 400)
    break
  }
}
const ms = performance.now() - t0

const rad = family.radicals
const bPrior = predictedB(rad, { nonCardinalAsymmetricRotation: false, cheapRuleIds: [] })
console.log(
  JSON.stringify(
    {
      family: family.code,
      axes: family.axes,
      cheapAxes: family.cheapAxes ?? null,
      distractorPlan: family.distractorPlan,
      optionCount: family.distractorPlan.length + 1,
      radicals: rad,
      predictedB_noDiscount: Number(bPrior.toFixed(2)),
      band_noDiscount: band(bPrior),
      seeds: SEEDS,
      perSeed: PER_SEED,
      attempted,
      accepted,
      acceptRate: attempted ? Number((accepted / attempted).toFixed(2)) : 0,
      rejects,
      thrown,
      blindHitRate: { max: Number(maxPHit.toFixed(3)), mean: accepted ? Number((sumPHit / accepted).toFixed(3)) : null, ceiling: 0.25 },
      keySlots,
      optionCountsObserved: [...optionCounts],
      msPerAttempt: attempted ? Number((ms / attempted).toFixed(1)) : null,
    },
    null,
    2,
  ),
)

if (htmlOut) {
  const css = `body{font:13px system-ui;margin:20px;background:#f4f4f5}section{background:#fff;padding:12px;margin-bottom:18px;border:1px solid #e5e7eb;max-width:720px}h3{margin:0 0 8px;font-size:13px}.grid{display:grid;grid-template-columns:repeat(3,120px);gap:6px;margin-bottom:10px}.cell{width:120px;height:120px;border:1px solid #d1d5db}.cell svg{width:100%;height:100%}.blank{display:flex;align-items:center;justify-content:center;font-size:40px;color:#9ca3af}.opts{display:flex;gap:6px}.opt{position:relative;width:100px;height:100px;border:1px solid #d1d5db}.opt svg{width:100%;height:100%}.opt span{position:absolute;left:3px;top:1px;font-size:11px;color:#6b7280}.opt.key{outline:2px solid #16a34a}`
  writeFileSync(htmlOut, `<!doctype html><html><head><meta charset="utf-8"><title>${family.code}</title><style>${css}</style></head><body>${sampleSvgs.join('')}</body></html>`)
  console.log(`wrote ${htmlOut}`)
}
