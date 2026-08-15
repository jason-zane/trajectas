import 'server-only'
import { z } from 'zod'
import {
  CognitiveOptionSpec,
  FiguralMatrixItemSpec,
  OptionSlot,
  type CognitiveOptionSpec as CognitiveOptionSpecType,
  type FiguralMatrixItemSpec as FiguralMatrixItemSpecType,
} from '@/lib/cognitive/spec/schema'

/**
 * The on-disk contract for a generated cognitive item bank — i.e. the
 * `items.json` / `summary.json` pair that
 * `scripts/cognitive/generate-matrix-bank.ts` writes (LR-7 / #337). This
 * module is the ONLY place that knows that file format; everything
 * downstream (plan.ts, ingest.ts) works on the parsed result.
 *
 * Why re-validate a file this repo produced itself: the generator writes to a
 * gitignored directory and the file travels by hand (laptop -> upload). By the
 * time it reaches ingest it is untrusted input like any other. Item and option
 * specs are parsed through the SAME `.strict()` zod schemas the delivery path
 * uses (`@/lib/cognitive/spec/schema`), so a bank file carrying a key-shaped
 * property inside a spec is rejected here, before it can meet the database's
 * `cognitive_item_specs_no_key` CHECK.
 *
 * ---------------------------------------------------------------------------
 * KNOWN GAP — per-distractor error labels
 * ---------------------------------------------------------------------------
 * #347 wants a reviewer to see per-distractor error labels (WR/IR/PM/RP...),
 * which is what `item_option_diagnostics` stores. The generator has always
 * KNOWN them — `distractors.ts`'s `PlacedOption` carries `label` and
 * `mechanism` — but `GeneratedItem.optionSpecs` narrows each placed option to
 * `CognitiveOptionSpec` = `{ slot, elements }`, and for a long time every
 * caller rebuilt the bank from `optionSpecs` alone, so the labels reached no
 * bank file and no reviewer ever saw one.
 *
 * They now travel alongside, in `GeneratedItem.optionDiagnostics`, and
 * `bankFilesFromGeneration` (src/lib/item-bank/from-generation.ts) merges them
 * back per option. Every producer routes through it, so a bank file carries
 * them whether it came from the CLI or the admin UI.
 *
 * The fields stay OPTIONAL here regardless: a bank file that carries them gets
 * `item_option_diagnostics` rows, one that does not gets none, and nothing else
 * changes. That keeps older bank files readable.
 */

/** Mirrors the DB CHECK on item_option_diagnostics.error_label. */
export const OptionErrorLabel = z.enum(['WR', 'IR', 'PM', 'RP', 'CNV', 'OVG', 'UMD', 'ATM', 'REV'])
export type OptionErrorLabel = z.infer<typeof OptionErrorLabel>

/**
 * The generator's own difficulty banding. Named "prior" wherever it surfaces
 * in this codebase: it is the output of a rule-based radical model whose
 * out-of-sample R² is ~0.43, with ~28% of variance sitting between clones
 * that are identical on every modelled radical. It is a design-time
 * expectation, never a measured or calibrated value.
 */
export const DifficultyPriorBand = z.enum(['easy', 'moderate', 'hard', 'very_hard'])
export type DifficultyPriorBand = z.infer<typeof DifficultyPriorBand>

const GateEntry = z.object({
  status: z.enum(['pass', 'fail', 'skip']),
})

/**
 * The QA fields ingest actually reads. The FULL `qa` object from the file is
 * carried through untouched into `cognitive_item_specs.qa` (see
 * `parseBankFile` below) — this schema validates, it does not narrow storage.
 */
const BankQaReport = z.object({
  generatorVersion: z.string().min(1),
  batteryVersion: z.string().min(1),
  passedAt: z.string().min(1),
  gates: z.record(z.string(), GateEntry),
  /** Design prior — see DifficultyPriorBand. */
  predictedB: z.number(),
  band: DifficultyPriorBand,
  contentHash: z.string().min(1),
  structuralHash: z.string().min(1),
})
export type BankQaReport = z.infer<typeof BankQaReport>

/**
 * One option as it appears in the file. `elements` is validated by
 * `CognitiveOptionSpec` in `parseBankFile` rather than here, so a single
 * failure message names the offending item and slot.
 */
const BankOptionEntry = z.object({
  slot: OptionSlot,
  elements: z.array(z.unknown()).min(1),
  errorLabel: OptionErrorLabel.nullish(),
  rationale: z.string().nullish(),
})

const BankItemEntry = z.object({
  familyCode: z.string().min(1),
  seed: z.string().min(1),
  keySlot: OptionSlot,
  itemSpec: FiguralMatrixItemSpec,
  optionSpecs: z.array(BankOptionEntry).length(5),
  qa: BankQaReport,
})

export const BankItemsFile = z.array(BankItemEntry).min(1)

/**
 * `summary.json`. Only the run-level provenance ingest records on
 * `cognitive_generation_runs` is required; the rest of the file is carried
 * verbatim into `qa_summary` so a run stays traceable to everything the
 * generator reported.
 */
export const BankSummaryFile = z.object({
  generatorVersion: z.string().min(1).nullable(),
  batteryVersion: z.string().min(1).nullable(),
  seed: z.string().min(1),
  perFamilyRequested: z.number().int().nonnegative(),
  startedAt: z.string().min(1),
  finishedAt: z.string().min(1),
  totalAttempted: z.number().int().nonnegative(),
  totalAccepted: z.number().int().nonnegative(),
  perFamily: z.record(
    z.string(),
    z.object({
      attempted: z.number().int().nonnegative(),
      accepted: z.number().int().nonnegative(),
      /** reason -> count. The generator never writes rejected items, only tallies them. */
      rejects: z.record(z.string(), z.number().int().nonnegative()),
    }),
  ),
  bandDistribution: z.record(z.string(), z.number().int().nonnegative()),
})
export type BankSummary = z.infer<typeof BankSummaryFile>

export type BankOption = {
  slot: z.infer<typeof OptionSlot>
  spec: CognitiveOptionSpecType
  /** Absent unless the bank file carries diagnostics — see the module header. */
  errorLabel: OptionErrorLabel | null
  errorRationale: string | null
}

export type BankItem = {
  familyCode: string
  /** `<rootSeed>/<familyCode>/<n>` — the item's stable, reproducible identity. */
  generatorSeed: string
  keySlot: z.infer<typeof OptionSlot>
  itemSpec: FiguralMatrixItemSpecType
  options: BankOption[]
  qa: BankQaReport
  /** The verbatim `qa` object from the file, stored as `cognitive_item_specs.qa`. */
  rawQa: unknown
}

export type ParsedBank = {
  items: BankItem[]
  summary: BankSummary
}

export class BankFileError extends Error {
  readonly detail: Record<string, unknown>
  constructor(message: string, detail: Record<string, unknown> = {}) {
    super(message)
    this.name = 'BankFileError'
    this.detail = detail
  }
}

/**
 * Validate an `items.json` + `summary.json` pair into the shape ingest works
 * on. Throws `BankFileError` with a pointer to the offending item rather than
 * a raw zod dump, because the caller is an admin pasting a file, not a
 * developer reading a stack trace.
 */
export function parseBankFile(itemsJson: unknown, summaryJson: unknown): ParsedBank {
  const summaryParsed = BankSummaryFile.safeParse(summaryJson)
  if (!summaryParsed.success) {
    throw new BankFileError('summary.json is not a valid generation-run summary', {
      issues: summaryParsed.error.issues.slice(0, 10),
    })
  }

  const itemsParsed = BankItemsFile.safeParse(itemsJson)
  if (!itemsParsed.success) {
    const first = itemsParsed.error.issues[0]
    throw new BankFileError('items.json is not a valid generated bank', {
      firstIssuePath: first?.path.join('.'),
      firstIssueMessage: first?.message,
      issueCount: itemsParsed.error.issues.length,
    })
  }

  const rawEntries = Array.isArray(itemsJson) ? (itemsJson as Array<Record<string, unknown>>) : []

  const items: BankItem[] = itemsParsed.data.map((entry, index) => {
    const options: BankOption[] = entry.optionSpecs.map((raw) => {
      const specParsed = CognitiveOptionSpec.safeParse({ slot: raw.slot, elements: raw.elements })
      if (!specParsed.success) {
        throw new BankFileError(
          `items.json[${index}] (${entry.familyCode} / ${entry.seed}) option ${raw.slot} is not a valid option spec`,
          { issues: specParsed.error.issues.slice(0, 5) },
        )
      }
      return {
        slot: raw.slot,
        spec: specParsed.data,
        errorLabel: raw.errorLabel ?? null,
        errorRationale: raw.rationale ?? null,
      }
    })

    const slots = options.map((o) => o.slot)
    if (new Set(slots).size !== slots.length) {
      throw new BankFileError(`items.json[${index}] (${entry.seed}) has duplicate option slots`, { slots })
    }
    if (!slots.includes(entry.keySlot)) {
      throw new BankFileError(`items.json[${index}] (${entry.seed}) names key slot ${entry.keySlot}, which has no option`, {
        slots,
      })
    }

    return {
      familyCode: entry.familyCode,
      generatorSeed: entry.seed,
      keySlot: entry.keySlot,
      itemSpec: entry.itemSpec,
      options,
      qa: entry.qa,
      rawQa: rawEntries[index]?.qa ?? entry.qa,
    }
  })

  return { items, summary: summaryParsed.data }
}
