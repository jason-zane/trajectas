/**
 * Shape a generator run into the two files `parseBankFile` reads.
 *
 * The generator emits `GenerateBatchResult`; ingest reads an `items.json` and a
 * `summary.json`. Four callers need that conversion — the bank-file CLI
 * (`generate-matrix-bank.ts`), the roundtrip harness, the live loader, and the
 * admin "generate and ingest" action — and each used to carry its own copy.
 * That is not a tidiness problem:
 *
 *   - Identical seeds must produce identical banks, or idempotency-by-content-
 *     hash stops meaning anything; a bank shaped differently by one caller
 *     re-ingests as new items instead of skipping what another already wrote.
 *   - The copies drifted in a way nobody noticed. Every hand-rolled projection
 *     emitted `{slot, elements}` per option and dropped the generator's
 *     `errorLabel` and `rationale`, so `item_option_diagnostics` was never
 *     written and reviewers saw four indistinguishable wrong answers.
 *
 * Two entry points, one projection: `bankFilesFromGeneration` returns the plain
 * documents (for the CLI, which writes them to disk), and `bankFromGeneration`
 * validates them (for everyone who ingests).
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

/** The two plain-JSON documents a bank is made of, before validation. */
export interface BankFiles {
  /** The contents of `items.json`. */
  items: unknown[]
  /** The contents of `summary.json`. */
  summary: Record<string, unknown>
}

/**
 * Project a batch result into the two documents, WITHOUT validating them.
 *
 * Exists separately from `bankFromGeneration` for one caller:
 * `scripts/cognitive/generate-matrix-bank.ts` writes these to disk rather than
 * ingesting them, so it needs the pre-parse shape. Sharing the projection is
 * what keeps a file written by the CLI identical to a bank ingested by the
 * admin UI — before this split, the CLI had its own copy that silently omitted
 * every distractor's error label.
 */
export function bankFilesFromGeneration(
  result: GenerateBatchResult,
  families: readonly FamilyTemplate<unknown>[],
  options: BankFromGenerationOptions,
): BankFiles {
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

  // The round trip through JSON is deliberate, and belongs here rather than at
  // each caller: it is what guarantees a bank held in memory and a bank read
  // back off disk are the same document, with no `undefined` holes or class
  // instances a file could never carry.
  return {
    items: JSON.parse(JSON.stringify(items)) as unknown[],
    summary: JSON.parse(JSON.stringify(summary)) as Record<string, unknown>,
  }
}

/**
 * Project a batch result into a parsed, validated bank.
 *
 * @throws BankFileError if the generator produced something the bank schema
 *   refuses — which is a generator bug, not a caller error.
 */
export function bankFromGeneration(
  result: GenerateBatchResult,
  families: readonly FamilyTemplate<unknown>[],
  options: BankFromGenerationOptions,
): ParsedBank {
  const files = bankFilesFromGeneration(result, families, options)
  return parseBankFile(files.items, files.summary)
}
