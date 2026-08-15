/**
 * Pilot-bank generation CLI. Doc 03-item-generation-pipeline.md §1's
 * `scripts/cognitive/generate-matrix-bank.mjs` ("thin CLI: parse args ->
 * call lib -> write via service role") — except this CLI never writes to
 * any database (LR-7's own scope: "Do not write to any database — emit
 * files"). It calls the pure `generator/` library and writes plain files:
 * a JSON bank (every accepted item's spec + QA report + provenance), a
 * JSON run summary, and an HTML contact sheet rendered with the actual
 * LR-4 renderer so a human can eyeball the whole batch at once.
 *
 * Usage:
 *   node --import ./scripts/cognitive/register-ts-loader.mjs \
 *     scripts/cognitive/generate-matrix-bank.ts \
 *     --seed=pilot-2026-08-13 --per-family=10 --out=var/cognitive-item-bank
 *
 * Why the `--import` loader rather than a plain `node script.ts`: see
 * ts-loader.mjs's header comment — this repo has no tsx/ts-node dependency
 * and this task's constraints rule out adding one (package.json is a
 * contended resource with a concurrently-running agent). Node 22's native
 * TypeScript stripping handles the rest; the loader only adds the
 * extensionless-relative-import and `@/`-alias resolution a bundler would
 * normally provide.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateBatch, type GeneratedItem } from '@/lib/cognitive/generator/index'
import { ALL_FAMILIES } from '@/lib/cognitive/generator/families/index'
import { contentHash } from '@/lib/cognitive/spec/hash'
import { toRenderSpec } from '@/lib/cognitive/spec/project'
import { renderMatrixGrid, renderOptionTile } from '@/lib/cognitive/render/matrix-svg'
import { m1ItemSpec } from '../../tests/fixtures/cognitive/m1'
import { m6ItemSpec } from '../../tests/fixtures/cognitive/m6'
import { batchBlindHitRate } from '@/lib/cognitive/generator/qa/contextblind'

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const arg of argv) {
    const m = /^--([a-zA-Z-]+)(?:=(.*))?$/.exec(arg)
    if (m) out[m[1]] = m[2] ?? 'true'
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
const seed = args.seed ?? 'pilot-default-seed'
const perFamily = Number.parseInt(args['per-family'] ?? '10', 10)
const outDir = args.out ?? 'var/cognitive-item-bank'

mkdirSync(outDir, { recursive: true })

// Existing-bank duplicate detection (doc §9.3 / G-13) — the LR-4 exemplar
// fixtures are the only pre-existing "bank" this repo has; a real deployment
// would also union in every item already in `cognitive_item_specs`.
const existingContentHashes = new Set<string>([
  contentHash({ specVersion: m1ItemSpec.specVersion, kind: m1ItemSpec.kind, grid: m1ItemSpec.grid, rules: m1ItemSpec.rules, radicals: m1ItemSpec.radicals, render: m1ItemSpec.render }),
  contentHash({ specVersion: m6ItemSpec.specVersion, kind: m6ItemSpec.kind, grid: m6ItemSpec.grid, rules: m6ItemSpec.rules, radicals: m6ItemSpec.radicals, render: m6ItemSpec.render }),
])

const startedAt = new Date().toISOString()
const result = generateBatch(ALL_FAMILIES, seed, perFamily, { existingContentHashes })
const finishedAt = new Date().toISOString()

// ---------------------------------------------------------------------------
// bank/items.json — every accepted item, full provenance.
// ---------------------------------------------------------------------------
const itemsOut = result.items.map((item: GeneratedItem) => ({
  familyCode: item.familyCode,
  seed: item.seed,
  keySlot: item.keySlot,
  itemSpec: item.itemSpec,
  optionSpecs: item.optionSpecs,
  qa: item.qa,
}))
writeFileSync(join(outDir, 'items.json'), JSON.stringify(itemsOut, null, 2))

// ---------------------------------------------------------------------------
// bank/summary.json — run-level report.
// ---------------------------------------------------------------------------
const bandCounts: Record<string, number> = { easy: 0, moderate: 0, hard: 0, very_hard: 0 }
for (const item of result.items) bandCounts[item.qa.band]++
const keySlotCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 }
for (const item of result.items) keySlotCounts[item.keySlot]++

const blindItems = result.items.map((item: GeneratedItem) => {
  const keyIdx = item.optionSpecs.findIndex((o) => o.slot === item.keySlot)
  const family = ALL_FAMILIES.find((f) => f.code === item.familyCode)!
  return { options: item.optionSpecs.map((o) => ({ elements: o.elements })), keyIndex: keyIdx, axes: family.axes }
})
const blindHitRate = batchBlindHitRate(blindItems)

const summary = {
  generatorVersion: result.items[0]?.qa.generatorVersion ?? null,
  batteryVersion: result.items[0]?.qa.batteryVersion ?? null,
  seed,
  perFamilyRequested: perFamily,
  startedAt,
  finishedAt,
  totalAttempted: Object.values(result.attempted).reduce((a, b) => a + b, 0),
  totalAccepted: result.items.length,
  perFamily: Object.fromEntries(ALL_FAMILIES.map((f) => [f.code, { attempted: result.attempted[f.code], accepted: result.items.filter((i) => i.familyCode === f.code).length, rejects: result.rejects[f.code] }])),
  bandDistribution: bandCounts,
  keySlotDistribution: keySlotCounts,
  contextBlindBatch: blindHitRate,
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2))

// ---------------------------------------------------------------------------
// bank/preview.html — contact sheet, rendered with the real LR-4 renderer.
// ---------------------------------------------------------------------------
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const cards = result.items
  .map((item: GeneratedItem) => {
    const rendered = toRenderSpec(item.itemSpec, item.optionSpecs)
    const gridHtml = renderMatrixGrid(rendered)
    const optionsHtml = rendered.options
      .map((o) => `<div class="opt${o.slot === item.keySlot ? ' key' : ''}"><div class="opt-label">${o.slot}</div>${renderOptionTile(o.elements, rendered.render)}</div>`)
      .join('')
    return `<section class="item">
      <h2>${escapeHtml(item.familyCode)} <span class="band">${escapeHtml(item.qa.band)}</span> <span class="b">predicted_b=${item.qa.predictedB.toFixed(2)}</span></h2>
      <div class="seed">${escapeHtml(item.seed)}</div>
      <div class="grid">${gridHtml}</div>
      <div class="options">${optionsHtml}</div>
    </section>`
  })
  .join('\n')

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Cognitive item bank preview</title>
<style>
  body { font-family: system-ui, sans-serif; background: #f8fafc; color: #111827; margin: 0; padding: 24px; }
  h1 { font-size: 20px; }
  .meta { color: #6b7280; margin-bottom: 24px; }
  .item { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
  .item h2 { font-size: 14px; margin: 0 0 4px; }
  .band { color: #2563eb; font-weight: normal; }
  .b { color: #9ca3af; font-weight: normal; font-size: 12px; }
  .seed { font-size: 11px; color: #9ca3af; margin-bottom: 12px; font-family: monospace; }
  .grid { display: grid; grid-template-columns: repeat(3, 90px); gap: 4px; margin-bottom: 12px; }
  .grid > div { width: 90px; height: 90px; border: 1px solid #d1d5db; background: white; }
  .grid svg, .opt svg { width: 100%; height: 100%; }
  .options { display: flex; gap: 8px; flex-wrap: wrap; }
  .opt { width: 70px; }
  .opt > div:not(.opt-label) { border: 1px solid #d1d5db; width: 70px; height: 70px; background: white; }
  .opt-label { font-size: 11px; color: #6b7280; text-align: center; }
  .opt.key .opt-label { color: #059669; font-weight: bold; }
  .opt.key > div:not(.opt-label) { border-color: #059669; border-width: 2px; }
</style></head>
<body>
  <h1>Cognitive item bank preview</h1>
  <div class="meta">seed=${escapeHtml(seed)} · ${result.items.length} items · generated ${escapeHtml(finishedAt)}</div>
  ${cards}
</body></html>`

writeFileSync(join(outDir, 'preview.html'), html)

// ---------------------------------------------------------------------------
// Console summary.
// ---------------------------------------------------------------------------
console.log(`Cognitive item bank generation complete.`)
console.log(`  seed: ${seed}`)
console.log(`  requested: ${perFamily}/family x ${ALL_FAMILIES.length} families = ${perFamily * ALL_FAMILIES.length} attempted`)
console.log(`  accepted: ${result.items.length}`)
console.log(`  band distribution: ${JSON.stringify(bandCounts)}`)
console.log(`  key-slot distribution: ${JSON.stringify(keySlotCounts)}`)
console.log(`  batch context-blind hits: ${blindHitRate.hits}/${blindHitRate.n} (chance interval [${blindHitRate.lowerBound},${blindHitRate.upperBound}])`)
console.log(`  wrote: ${join(outDir, 'items.json')}`)
console.log(`  wrote: ${join(outDir, 'summary.json')}`)
console.log(`  wrote: ${join(outDir, 'preview.html')}`)
for (const f of ALL_FAMILIES) {
  const accepted = result.items.filter((i) => i.familyCode === f.code).length
  const rejects = result.rejects[f.code]
  console.log(`  ${f.code}: ${accepted}/${result.attempted[f.code]} accepted${Object.keys(rejects).length > 0 ? `, rejects=${JSON.stringify(rejects)}` : ''}`)
}
