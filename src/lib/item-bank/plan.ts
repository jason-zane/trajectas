import 'server-only'
import { contentHash } from '@/lib/cognitive/spec/hash'
import type { OptionSlot } from '@/lib/cognitive/spec/schema'
import type { BankItem, DifficultyPriorBand, OptionErrorLabel, ParsedBank } from './bank-file'

/**
 * The pure half of bank ingest: given a parsed bank file and a snapshot of
 * what the bank already contains, decide what to write. No I/O, no clients —
 * everything interesting about idempotency is decidable here and therefore
 * unit-testable without a database.
 *
 * ---------------------------------------------------------------------------
 * IDEMPOTENCY — the mechanism, precisely
 * ---------------------------------------------------------------------------
 * Every item is content-addressed with `contentHash()` from
 * `@/lib/cognitive/spec/hash` (sha256 over the canonical, key-sorted JSON of
 * the item spec) — the same function the generator's G-13 duplicate gate uses,
 * so the two agree by construction rather than by coincidence.
 *
 * Ingest RECOMPUTES the hash from the spec rather than trusting the
 * `qa.contentHash` field in the file. A file whose stated hash disagrees with
 * its own content has been edited after generation, and is rejected outright:
 * trusting the stated hash would let an edited item masquerade as an already-
 * ingested one and silently skip.
 *
 * Three outcomes per item:
 *
 *   - hash already in the bank            -> SKIP. Re-running the same bank
 *                                            writes nothing.
 *   - (familyCode, generatorSeed) already
 *     in the bank under a DIFFERENT hash  -> CONFLICT (see below).
 *   - otherwise                           -> INSERT.
 *
 * The database backs this up: `items_live_content_hash_unique`
 * (20260814110000) is a partial unique index over live items' content hashes,
 * so two ingests racing on the same bank cannot both win.
 *
 * ---------------------------------------------------------------------------
 * WHAT HAPPENS TO A CHANGED ITEM SHARING AN ID — decision and rationale
 * ---------------------------------------------------------------------------
 * An item's stable identity across runs is `(familyCode, generatorSeed)`:
 * seeds are deterministic (`<rootSeed>/<familyCode>/<n>`), so re-running the
 * same root seed reproduces the same identities. If such an item comes back
 * with a DIFFERENT content hash, the generator changed underneath it — a
 * version bump, a re-authored family, a widened distractor grammar.
 *
 * Three options were available: skip it, error, or auto-version it (clone with
 * `parent_item_id` + `item_version + 1`). This picks **error, refusing the
 * whole ingest before writing anything**, because:
 *
 *   1. SKIP is the actively dangerous one. The operator believes they have
 *      ingested the bank in front of them; the database holds different
 *      content under the same identity, and nothing says so. Every downstream
 *      artefact — the reviewer's sign-off, the frozen session form's
 *      content_hash drift check — is then reasoning about content nobody
 *      chose.
 *   2. AUTO-VERSION quietly doubles the bank. The existing item may already be
 *      `operational` with exposure counts and sign-offs against it; its clone
 *      arrives in `draft` with neither, and both are now live rows in the same
 *      family competing for selection. Cloning is a deliberate editorial act
 *      that has to go back through content and fairness review — a re-run of a
 *      script is not that act.
 *   3. ERROR is recoverable and loses nothing. The operator either bumps the
 *      root seed (new identities, both banks coexist) or explicitly clones the
 *      affected items. The conflict list names exactly which items and both
 *      hashes.
 *
 * Refusal is all-or-nothing and happens before the first insert, so a bank
 * with one conflicting item leaves the database exactly as it was. (There is
 * deliberately no `cognitive_generation_runs` row for a refused attempt: a
 * run row is provenance for items that exist, and writing one for an ingest
 * that wrote nothing would make "every item traces to a run" false in the
 * other direction. The thrown error carries the full conflict list and the
 * calling Server Action logs it.)
 */

export type PlannedOption = {
  slot: OptionSlot
  /** `item_options.label` — the slot letter, matching the delivery fixtures. */
  label: string
  /** `item_options.value` — 1-based slot ordinal. Inert for cognitive items (scoring is by key). */
  value: number
  displayOrder: number
  /** `cognitive_option_specs.spec`. */
  spec: unknown
  isKey: boolean
  /** `item_option_diagnostics.error_label`; null when the bank file carries no diagnostics. */
  errorLabel: OptionErrorLabel | null
  errorRationale: string | null
}

export type PlannedItem = {
  familyCode: string
  generatorSeed: string
  contentHash: string
  structuralHash: string
  stem: string
  keySlot: OptionSlot
  /** `cognitive_item_specs.spec`. */
  itemSpec: unknown
  /** `cognitive_item_specs.qa` — the generator's verbatim QA report. */
  qa: unknown
  /**
   * DESIGN PRIOR from the rule-based radical model, NOT a measured or
   * calibrated difficulty. See bank-file.ts's `DifficultyPriorBand`.
   */
  difficultyPriorB: number
  difficultyPriorBand: DifficultyPriorBand
  options: PlannedOption[]
}

export type PlannedFamily = {
  code: string
  kind: 'figural_matrix'
  /** Rule ids the family's items assert, e.g. ['R6','R2']. */
  rules: string[]
  /** The family's radical profile (constant across its clones). */
  radicals: unknown
  /** Mean design prior across the family's items in this bank — see note in `buildIngestPlan`. */
  difficultyPriorB: number
  /** Modal design-prior band across the family's items in this bank. */
  difficultyPriorBand: DifficultyPriorBand
}

export type IngestConflict = {
  familyCode: string
  generatorSeed: string
  existingItemId: string
  existingContentHash: string
  incomingContentHash: string
}

export type SkippedItem = {
  familyCode: string
  generatorSeed: string
  contentHash: string
  existingItemId: string
}

export type ExistingBankState = {
  /** `items.content_hash` -> `items.id`, live items only. */
  itemIdByContentHash: ReadonlyMap<string, string>
  /** `familySeedKey(code, seed)` -> the item already occupying that identity. */
  itemByFamilySeed: ReadonlyMap<string, { itemId: string; contentHash: string | null }>
  /** `item_families.code` -> `item_families.id`. */
  familyIdByCode: ReadonlyMap<string, string>
}

export type BankIngestPlan = {
  itemsToInsert: PlannedItem[]
  skipped: SkippedItem[]
  conflicts: IngestConflict[]
  familiesToCreate: PlannedFamily[]
  /** Families the bank references that already exist; left untouched. */
  existingFamilyIdByCode: ReadonlyMap<string, string>
  /** Items whose stated `qa.contentHash` disagreed with the recomputed hash. */
  hashMismatches: Array<{ familyCode: string; generatorSeed: string; stated: string; recomputed: string }>
}

/** Composite identity key. NUL-separated, because NUL cannot occur in a family code or a seed. */
export function familySeedKey(familyCode: string, generatorSeed: string): string {
  return `${familyCode}\u0000${generatorSeed}`
}

/** Default instruction stem for a figural matrix; matches the delivery fixtures. */
export const DEFAULT_MATRIX_STEM = 'Which figure completes the pattern?'

const SLOT_ORDER: OptionSlot[] = ['A', 'B', 'C', 'D', 'E']

export type BuildPlanOptions = {
  /** `items.stem`. Cognitive matrices carry an instruction, not a question. */
  stem?: string
}

/**
 * Recompute an item's content hash from its spec. Exported so callers (and
 * tests) can assert the file-vs-content agreement independently.
 */
export function itemContentHash(item: BankItem): string {
  return contentHash(item.itemSpec)
}

export function buildIngestPlan(
  bank: ParsedBank,
  existing: ExistingBankState,
  options: BuildPlanOptions = {},
): BankIngestPlan {
  const stem = options.stem ?? DEFAULT_MATRIX_STEM

  const itemsToInsert: PlannedItem[] = []
  const skipped: SkippedItem[] = []
  const conflicts: IngestConflict[] = []
  const hashMismatches: BankIngestPlan['hashMismatches'] = []

  // Hashes claimed by earlier items in THIS file, so a bank that contains the
  // same item twice is caught even on a first-ever ingest (the DB's unique
  // index would catch it too, but as a mid-insert failure rather than a
  // pre-flight refusal).
  const seenHashes = new Set<string>()
  const seenIdentities = new Set<string>()

  for (const item of bank.items) {
    const hash = itemContentHash(item)
    if (hash !== item.qa.contentHash) {
      hashMismatches.push({
        familyCode: item.familyCode,
        generatorSeed: item.generatorSeed,
        stated: item.qa.contentHash,
        recomputed: hash,
      })
      continue
    }

    const identity = familySeedKey(item.familyCode, item.generatorSeed)
    if (seenIdentities.has(identity)) {
      conflicts.push({
        familyCode: item.familyCode,
        generatorSeed: item.generatorSeed,
        existingItemId: '(same file)',
        existingContentHash: '(duplicate identity within items.json)',
        incomingContentHash: hash,
      })
      continue
    }
    seenIdentities.add(identity)

    const existingByIdentity = existing.itemByFamilySeed.get(identity)
    if (existingByIdentity && existingByIdentity.contentHash !== hash) {
      conflicts.push({
        familyCode: item.familyCode,
        generatorSeed: item.generatorSeed,
        existingItemId: existingByIdentity.itemId,
        existingContentHash: existingByIdentity.contentHash ?? '(null)',
        incomingContentHash: hash,
      })
      continue
    }

    const existingId = existing.itemIdByContentHash.get(hash)
    if (existingId) {
      skipped.push({
        familyCode: item.familyCode,
        generatorSeed: item.generatorSeed,
        contentHash: hash,
        existingItemId: existingId,
      })
      continue
    }

    if (seenHashes.has(hash)) {
      conflicts.push({
        familyCode: item.familyCode,
        generatorSeed: item.generatorSeed,
        existingItemId: '(same file)',
        existingContentHash: hash,
        incomingContentHash: hash,
      })
      continue
    }
    seenHashes.add(hash)

    itemsToInsert.push({
      familyCode: item.familyCode,
      generatorSeed: item.generatorSeed,
      contentHash: hash,
      structuralHash: item.qa.structuralHash,
      stem,
      keySlot: item.keySlot,
      itemSpec: item.itemSpec,
      qa: item.rawQa,
      difficultyPriorB: item.qa.predictedB,
      difficultyPriorBand: item.qa.band,
      options: buildOptions(item),
    })
  }

  // Families are derived from the items being inserted, not from the whole
  // file: a family whose items are all already present needs no row created,
  // and one that already exists is deliberately LEFT ALONE. A family row is a
  // design object (its radicals and rule set define what the family IS); if a
  // re-authored family produced different radicals its items would hash
  // differently and surface as conflicts above, so silently rewriting the row
  // here would erase the very evidence that something changed.
  const familiesToCreate: PlannedFamily[] = []
  const existingFamilyIdByCode = new Map<string, string>()
  const byCode = new Map<string, PlannedItem[]>()
  for (const planned of itemsToInsert) {
    const list = byCode.get(planned.familyCode)
    if (list) list.push(planned)
    else byCode.set(planned.familyCode, [planned])
  }

  for (const [code, members] of byCode) {
    const existingId = existing.familyIdByCode.get(code)
    if (existingId) {
      existingFamilyIdByCode.set(code, existingId)
      continue
    }
    const source = bank.items.find((i) => i.familyCode === code)!
    const radicals = source.itemSpec.radicals
    familiesToCreate.push({
      code,
      kind: 'figural_matrix',
      rules: [...radicals.ruleIds],
      radicals,
      // A family's prior is summarised from its members' priors rather than
      // recomputed: `predictedB` varies slightly within a family (it takes
      // per-item incidentals such as non-cardinal asymmetric rotation into
      // account), and recomputing it here would mean importing and pinning the
      // generator's difficulty model — a second source of truth for a number
      // that is only ever a prior.
      difficultyPriorB: mean(members.map((m) => m.difficultyPriorB)),
      difficultyPriorBand: modalBand(members.map((m) => m.difficultyPriorBand)),
    })
  }

  // Families referenced only by already-present items still resolve, so the
  // caller can report "this bank belongs to families X, Y".
  for (const item of bank.items) {
    const id = existing.familyIdByCode.get(item.familyCode)
    if (id) existingFamilyIdByCode.set(item.familyCode, id)
  }

  return { itemsToInsert, skipped, conflicts, familiesToCreate, existingFamilyIdByCode, hashMismatches }
}

function buildOptions(item: BankItem): PlannedOption[] {
  const ordered = [...item.options].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot))
  return ordered.map((option, index) => ({
    slot: option.slot,
    label: option.slot,
    value: index + 1,
    displayOrder: index,
    spec: option.spec,
    isKey: option.slot === item.keySlot,
    errorLabel: option.errorLabel,
    errorRationale: option.errorRationale,
  }))
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function modalBand(bands: DifficultyPriorBand[]): DifficultyPriorBand {
  const counts = new Map<DifficultyPriorBand, number>()
  for (const band of bands) counts.set(band, (counts.get(band) ?? 0) + 1)
  let best: DifficultyPriorBand = bands[0] ?? 'moderate'
  let bestCount = -1
  for (const [band, count] of counts) {
    if (count > bestCount) {
      best = band
      bestCount = count
    }
  }
  return best
}
