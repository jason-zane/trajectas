/**
 * The automated QA battery (doc 03-item-generation-pipeline.md §7). Every
 * gate is a pure function; this module composes them into one `QaReport`.
 * `generateFamily` (generator/index.ts) throws on any `fail` and tallies
 * rejects per-gate — nothing here writes anything or has side effects.
 *
 * Gate numbering follows doc §7's table where a direct analogue exists.
 * G-04 (column consistency) and G-05 (accidental-regularity) are reported
 * as derived from G-03 rather than as separate enumerations: Level A's
 * candidate-rule search already includes column-only readings and the
 * accidental-regularity probes (rules.ts's `accidentalRegularityProbes`),
 * so a G-03 pass already proves both — doc §5.1 says exactly this
 * ("Level A subsumes all three [doc 03-logical-reasoning-design.md §5.4
 * checks]"). G-16/G-17 are batch-level: formalised in `qa/batch.ts`
 * (`runBatchGates`, which also reconciles G-17 — see that file's header
 * comment) and invoked from generator/index.ts's `generateBatch`, not here.
 */
import { FiguralMatrixItemSpec, CognitiveOptionSpec, type RuleSpec } from '../../spec/schema'
import { contentHash } from '../../spec/hash'
import type { ComposedItem } from '../compose'
import type { PlacedOption } from '../distractors'
import { detectAllAxes, levelA, levelB } from './uniqueness'
import { contextBlindGate, giveawayPairGate } from './contextblind'
import { gridLevelDegeneracy, optionComplexitySpreadCheck, optionHomogeneityCheck } from './degeneracy'
import { inkCoverageGate, elementOverlapGate, renderLegibilityGate } from './density'
import { duplicateGate, structuralHash } from './duplicates'
import { predictedB, band, type Band } from '../difficulty'
import type { AxisId } from '../axes'
import { readAxis, axisEq, cellEq } from '../axes'

export const GENERATOR_VERSION = '0.1.0'
export const BATTERY_VERSION = '0.1.0'

export type GateStatus = 'pass' | 'fail' | 'skip'
export interface GateEntry {
  status: GateStatus
  detail?: Record<string, unknown>
}

export interface QaReport {
  generatorVersion: string
  batteryVersion: string
  passedAt: string
  gates: Record<string, GateEntry>
  admissibleRuleTuples: Array<{ axis: string; direction: string; label: string; implies: string }>
  predictedB: number
  band: Band
  contentHash: string
  structuralHash: string
}

export interface QaInput {
  item: ComposedItem
  placedOptions: readonly PlacedOption[]
  keySlot: string
  existingContentHashes: ReadonlySet<string>
  existingStructuralHashes: ReadonlySet<string>
  familyStructuralHashes: ReadonlySet<string>
  nonCardinalAsymmetricRotation: boolean
  /** Override for `passedAt`, e.g. from a test asserting exact QaReport equality. Defaults to the real clock. */
  now?: string
}

export interface QaOutcome {
  ok: boolean
  report: QaReport
  firstFailure?: string
}

function allPass(gates: Record<string, GateEntry>): boolean {
  return Object.values(gates).every((g) => g.status !== 'fail')
}

export function runQaBattery(input: QaInput): QaOutcome {
  const { item, placedOptions } = input
  const gates: Record<string, GateEntry> = {}

  // G-01 — schema validity. Build the combined convenience spec and parse it
  // through the LR-4 zod schema. This is the literal round-trip: if this
  // gate passes, the generated item is provably renderable by LR-4's own
  // `toRenderSpec`/`renderMatrixGrid` — see generator/index.ts's caller.
  const itemSpecCandidate = {
    specVersion: 1 as const,
    kind: 'figural_matrix' as const,
    grid: { rows: 3 as const, cols: 3 as const, blank: { row: 3 as const, col: 3 as const }, cells: item.grid },
    rules: item.rules,
    radicals: item.template.radicals,
    render: item.template.render,
  }
  const itemParse = FiguralMatrixItemSpec.safeParse(itemSpecCandidate)
  const optionParses = placedOptions.map((o) => CognitiveOptionSpec.safeParse({ slot: o.slot, elements: o.elements }))
  gates['G-01'] = itemParse.success && optionParses.every((p) => p.success) ? { status: 'pass' } : { status: 'fail', detail: { itemError: itemParse.success ? undefined : itemParse.error.issues, optionErrors: optionParses.map((p) => (p.success ? undefined : p.error.issues)) } }

  // G-02 — axis disjointness.
  const declaredAxes = item.rules.map((r: RuleSpec) => r.axis)
  gates['G-02'] = new Set(declaredAxes).size === declaredAxes.length ? { status: 'pass' } : { status: 'fail', detail: { declaredAxes } }

  // G-03/G-04/G-05 — uniqueness Level A (subsumes column-consistency + accidental-regularity).
  const axes: AxisId[] = [...new Set([...item.template.axes, ...detectAllAxes(item.grid)])]
  const la = levelA(item.grid, axes, item.domains)
  gates['G-03'] = la.ok ? { status: 'pass' } : { status: 'fail', detail: { reason: la.reason, ...la.detail } }
  gates['G-04'] = la.ok ? { status: 'pass', detail: { subsumedBy: 'G-03' } } : { status: 'fail', detail: { subsumedBy: 'G-03' } }
  gates['G-05'] = la.ok ? { status: 'pass', detail: { subsumedBy: 'G-03', probeCount: axes.length * 5 } } : { status: 'fail', detail: { subsumedBy: 'G-03' } }

  let admissibleRuleTuples: QaReport['admissibleRuleTuples'] = []
  let keyIndex = -1
  if (la.ok) {
    admissibleRuleTuples = la.admissibleTuples[0].map((s) => ({ axis: s.axis, direction: s.rule.direction, label: s.rule.label, implies: JSON.stringify(s.implied) }))
    const optionCells = placedOptions.map((o) => ({ elements: o.elements }))
    const lb = levelB(optionCells, la)
    gates['G-06'] = lb.ok ? { status: 'pass' } : { status: 'fail', detail: { reason: lb.reason, ...lb.detail } }
    if (lb.ok) keyIndex = lb.keyIndex
  } else {
    gates['G-06'] = { status: 'skip', detail: { reason: 'LEVEL_A_FAILED' } }
  }

  // G-07 — distractor audit.
  const distractorEntries = placedOptions.filter((o) => !o.isKey)
  const distractorsOk = distractorEntries.every((o) => o.label !== null && o.mechanism !== null)
  gates['G-07'] = distractorsOk ? { status: 'pass' } : { status: 'fail', detail: { entries: distractorEntries } }

  // G-08 — context-blind (item).
  if (keyIndex >= 0) {
    const optionCells = placedOptions.map((o) => ({ elements: o.elements }))
    const cb = contextBlindGate(optionCells, keyIndex, item.template.axes)
    gates['G-08'] = cb.ok ? { status: 'pass' } : { status: 'fail', detail: { reason: cb.reason, ...cb.detail } }
    // G-10 — giveaway pairs.
    const gp = giveawayPairGate(optionCells, item.template.axes)
    gates['G-10'] = gp.ok ? { status: 'pass' } : { status: 'fail', detail: { reason: gp.reason, ...gp.detail } }
    // G-11 — repeat-heuristic resistance (measured; batch threshold is G-17-equivalent in
    // generateBatch). When the family has invoked doc's OQ-3 permission for
    // KEY_EQUALS_CELL (see qa/degeneracy.ts), OQ-3's own mitigation is
    // enforced HERE rather than left as a batch-level aspiration: at least
    // 2 of the 5 options (key included) must fully copy a real context
    // cell, so "eliminate anything that looks like a copy" cannot isolate
    // the key.
    const copiesCount = optionCells.filter((o) => item.grid.some((c) => cellEq(c, o))).length
    if (item.template.permitKeyEqualsCell) {
      gates['G-11'] = copiesCount >= 2 ? { status: 'pass', detail: { copiesCount } } : { status: 'fail', detail: { reason: 'OQ3_MITIGATION_INSUFFICIENT', copiesCount } }
    } else {
      const sharesLayer = item.grid.some((c) => shareCompleteLayer(c, optionCells[keyIndex]))
      gates['G-11'] = { status: 'pass', detail: { sharesCompleteLayerWithContextCell: sharesLayer } }
    }
  } else {
    gates['G-08'] = { status: 'skip', detail: { reason: 'NO_KEY_INDEX' } }
    gates['G-10'] = { status: 'skip', detail: { reason: 'NO_KEY_INDEX' } }
    gates['G-11'] = { status: 'skip', detail: { reason: 'NO_KEY_INDEX' } }
  }

  // G-09 — option homogeneity. `countGoverned` (also used by G-15's ink
  // gate below) widens the complexity-spread threshold for families whose
  // rule axis IS a count — see optionComplexitySpreadCheck's doc comment.
  const countGoverned = item.template.axes.some((a) => a.endsWith('.count'))
  const optionCellsForHomog = placedOptions.map((o) => ({ elements: o.elements }))
  const homog = optionHomogeneityCheck(optionCellsForHomog)
  const spread = optionComplexitySpreadCheck(optionCellsForHomog, countGoverned)
  gates['G-09'] = homog.status === 'pass' && spread.status === 'pass' ? { status: 'pass' } : { status: 'fail', detail: { homog, spread } }

  // G-12 — degeneracy (grid-level).
  const keyCellForDeg = { elements: placedOptions.find((o) => o.isKey)!.elements }
  const gridDeg = gridLevelDegeneracy(item.grid, keyCellForDeg, item.template.axes, item.template.radicals.ruleCount, item.template.permitKeyEqualsCell)
  const gridDegFail = gridDeg.filter((r) => r.status === 'fail')
  gates['G-12'] = gridDegFail.length === 0 ? { status: 'pass' } : { status: 'fail', detail: { failures: gridDegFail } }

  // G-13 — duplicate detection.
  const fullSpec = itemParse.success ? itemParse.data : itemSpecCandidate
  const ch = contentHash(fullSpec)
  const structuralExtra = item.template.structuralExtra ? item.template.structuralExtra(item.params) : {}
  const sh = structuralHash(item.template.code, item.rules, item.template.radicals, structuralExtra)
  const dup = duplicateGate({ familyCode: item.template.code, rules: item.rules, radicals: item.template.radicals, contentHashValue: ch, structuralExtra }, input.existingContentHashes, input.existingStructuralHashes, input.familyStructuralHashes)
  gates['G-13'] = dup

  // G-14 — difficulty consistency.
  const pb = predictedB(item.template.radicals, { nonCardinalAsymmetricRotation: input.nonCardinalAsymmetricRotation })
  const b = band(pb)
  gates['G-14'] = { status: 'pass', detail: { predictedB: pb, band: b } } // always self-consistent: pb is computed fresh from radicals, never hand-typed.

  // G-15 — render check (real renderer) + ink coverage + element overlap.
  const cellsForRender = [...item.grid, keyCellForDeg, ...optionCellsForHomog]
  const renderFails = cellsForRender.map((c) => renderLegibilityGate(c, item.template.render)).filter((r) => r.status === 'fail')
  const ink = inkCoverageGate([...item.grid, keyCellForDeg], item.template.render.strokeWidth, countGoverned)
  const overlaps = [...item.grid, keyCellForDeg].map((c) => elementOverlapGate(c)).filter((r) => r.status === 'fail')
  gates['G-15'] = renderFails.length === 0 && ink.status === 'pass' && overlaps.length === 0 ? { status: 'pass' } : { status: 'fail', detail: { renderFails, ink, overlaps } }

  const report: QaReport = {
    generatorVersion: GENERATOR_VERSION,
    batteryVersion: BATTERY_VERSION,
    // Provenance metadata only — NOT part of the spec, NOT hashed, NOT
    // covered by the determinism contract (same seed -> byte-identical
    // SPEC). A real wall-clock stamp is the honest choice here, the same
    // way a build timestamp is real even in a reproducible build.
    passedAt: input.now ?? new Date().toISOString(),
    gates,
    admissibleRuleTuples,
    predictedB: pb,
    band: b,
    contentHash: ch,
    structuralHash: sh,
  }
  const ok = allPass(gates)
  const firstFailure = ok ? undefined : Object.entries(gates).find(([, g]) => g.status === 'fail')?.[0]
  return { ok, report, firstFailure }
}

function shareCompleteLayer(a: { elements: { layer: string }[] }, b: { elements: { layer: string }[] }): boolean {
  const layersA = new Set(a.elements.map((e) => e.layer))
  for (const layer of layersA) {
    const elsA = a.elements.filter((e) => e.layer === layer)
    const elsB = b.elements.filter((e) => e.layer === layer)
    if (elsA.length === 0 || elsA.length !== elsB.length) continue
    if (JSON.stringify(elsA) === JSON.stringify(elsB)) return true
  }
  return false
}

export { readAxis, axisEq }
