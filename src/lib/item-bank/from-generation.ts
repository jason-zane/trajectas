/**
 * Shape a generator run into the two files `parseBankFile` reads.
 *
 * The generator emits `GenerateBatchResult`; ingest reads an `items.json` and a
 * `summary.json`. Three callers needed that conversion — the CLI generator, the
 * roundtrip harness, and the admin "generate and ingest" action — and had three
 * copies of it. Identical seeds have to produce identical banks across all
 * three or idempotency-by-content-hash stops meaning anything: a bank shaped
 * slightly differently by the UI would re-ingest as new items rather than
 * skipping the ones the CLI already wrote.
 *
 * The round trip through JSON is deliberate. `parseBankFile` is the validation
 * boundary, and it should see the same plain data an uploaded file would
 * present — not live objects carrying class instances or `undefined` holes that
 * a file could never contain.
 *
 * @module
 */

import type { FamilyTemplate, GenerateBatchResult } from '@/lib/cognitive/generator/index'
import { parseBankFile, type ParsedBank } from './bank-file'

export interface BankFromGenerationOptions {
  /** The seed the batch was generated from. Recorded so the run is replayable. */
  seed: string
  /** What was asked for per family, which is not what was necessarily accepted. */
  perFamily: number
  /** Generation start, ISO 8601. Defaults to now. */
  startedAt?: string
  /** Generation finish, ISO 8601. Defaults to now. */
  finishedAt?: string
}

/**
 * Convert a batch result into a parsed, validated bank.
 *
 * @throws BankFileError if the generator produced something the bank schema
 *   refuses — which is a generator bug, not a caller error.
 */
export function bankFromGeneration(
  result: GenerateBatchResult,
  families: readonly FamilyTemplate<unknown>[],
  options: BankFromGenerationOptions,
): ParsedBank {
  const items = result.items.map((item) => {
    // `optionSpecs` is the render instruction; `optionDiagnostics` says why each
    // distractor is wrong. The bank file carries them on one entry per option,
    // and `parseBankFile` splits them again — the spec goes to
    // `cognitive_option_specs` (participant-visible), the label and rationale to
    // `item_option_diagnostics` (admin-only). Merging here rather than in each
    // caller is what stopped them being silently dropped: the generator emitted
    // both and every caller reconstructed only the first.
    const bySlot = new Map(item.optionDiagnostics.map((d) => [d.slot, d]))
    return {
      familyCode: item.familyCode,
      seed: item.seed,
      keySlot: item.keySlot,
      itemSpec: item.itemSpec,
      optionSpecs: item.optionSpecs.map((option) => {
        const diagnostic = bySlot.get(option.slot)
        return {
          ...option,
          errorLabel: diagnostic?.errorLabel ?? null,
          rationale: diagnostic?.rationale ?? null,
        }
      }),
      qa: item.qa,
    }
  })

  // Every band is present even at zero, so a distribution never reads as
  // "no very-hard items generated" when it means "the key was absent".
  const bandDistribution: Record<string, number> = { easy: 0, moderate: 0, hard: 0, very_hard: 0 }
  for (const item of result.items) bandDistribution[item.qa.band]++

  const now = new Date().toISOString()
  const summary = {
    generatorVersion: result.items[0]?.qa.generatorVersion ?? null,
    batteryVersion: result.items[0]?.qa.batteryVersion ?? null,
    seed: options.seed,
    perFamilyRequested: options.perFamily,
    startedAt: options.startedAt ?? now,
    finishedAt: options.finishedAt ?? now,
    totalAttempted: Object.values(result.attempted).reduce((a, b) => a + b, 0),
    totalAccepted: result.items.length,
    perFamily: Object.fromEntries(
      families.map((family) => [
        family.code,
        {
          attempted: result.attempted[family.code] ?? 0,
          accepted: result.items.filter((i) => i.familyCode === family.code).length,
          rejects: result.rejects[family.code] ?? {},
        },
      ]),
    ),
    bandDistribution,
  }

  return parseBankFile(
    JSON.parse(JSON.stringify(items)) as unknown,
    JSON.parse(JSON.stringify(summary)) as unknown,
  )
}
