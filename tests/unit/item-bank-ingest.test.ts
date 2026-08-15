/**
 * Bank ingest — file parsing, the idempotency decision, and the write
 * orchestration (LR-8 / #347 scope item 1).
 *
 * These are unit tests over the PURE half plus a recording fake store, so
 * every branch of the idempotency policy is covered without a database. The
 * end-to-end round trip against a real PostgreSQL cluster (real triggers, real
 * constraints, real unique index) lives in
 * `scripts/cognitive/ingest-roundtrip.ts` — see its header for why it is a
 * script rather than a vitest integration test in this environment.
 *
 * Fixtures are the hand-pinned LR-4 exemplars (m1/m6), NOT generator output:
 * this suite must not depend on any family's behaviour.
 */

import { describe, expect, it } from 'vitest'
import { m1ItemSpec, m1OptionSpecs } from '../fixtures/cognitive/m1'
import { m6ItemSpec, m6OptionSpecs } from '../fixtures/cognitive/m6'
import { contentHash } from '@/lib/cognitive/spec/hash'
import { parseBankFile, BankFileError } from '@/lib/item-bank/bank-file'
import { buildIngestPlan, familySeedKey, type ExistingBankState } from '@/lib/item-bank/plan'
import { ingestGeneratedBank, BankIngestConflictError } from '@/lib/item-bank/ingest'
import type {
  AnswerKeyInsert,
  FamilyInsert,
  GenerationRunFinish,
  GenerationRunInsert,
  ItemBankStore,
  ItemInsert,
  ItemSpecInsert,
  OptionDiagnosticInsert,
  OptionInsert,
  OptionSpecInsert,
} from '@/lib/item-bank/store'

// ---------------------------------------------------------------------------
// Bank file fixtures
// ---------------------------------------------------------------------------

type OptionOverrides = { errorLabel?: string; rationale?: string }

function bankEntry(
  itemSpec: unknown,
  optionSpecs: ReadonlyArray<{ slot: string; elements: unknown }>,
  familyCode: string,
  seed: string,
  keySlot: string,
  optionOverrides: Record<string, OptionOverrides> = {},
) {
  return {
    familyCode,
    seed,
    keySlot,
    itemSpec,
    optionSpecs: optionSpecs.map((option) => ({
      slot: option.slot,
      elements: option.elements,
      ...(optionOverrides[option.slot] ?? {}),
    })),
    qa: {
      generatorVersion: '0.1.0',
      batteryVersion: '0.1.0',
      passedAt: '2026-08-13T00:00:00.000Z',
      gates: { 'G-01': { status: 'pass' }, 'G-13': { status: 'pass' }, 'G-06': { status: 'skip' } },
      predictedB: 0.42,
      band: 'moderate',
      contentHash: contentHash(itemSpec),
      structuralHash: 'sha256:structural-placeholder',
      admissibleRuleTuples: [],
    },
  }
}

const M1 = () => bankEntry(m1ItemSpec, m1OptionSpecs, 'LRM-PROG-COUNT', 'unit-seed/LRM-PROG-COUNT/0', 'B')
const M6 = () => bankEntry(m6ItemSpec, m6OptionSpecs, 'LRM-LATIN', 'unit-seed/LRM-LATIN/0', 'A')

function summary(overrides: Record<string, unknown> = {}) {
  return {
    generatorVersion: '0.1.0',
    batteryVersion: '0.1.0',
    seed: 'unit-seed',
    perFamilyRequested: 1,
    startedAt: '2026-08-13T00:00:00.000Z',
    finishedAt: '2026-08-13T00:00:01.000Z',
    totalAttempted: 4,
    totalAccepted: 2,
    perFamily: {
      'LRM-PROG-COUNT': { attempted: 2, accepted: 1, rejects: { 'G-08': 1 } },
      'LRM-LATIN': { attempted: 2, accepted: 1, rejects: { 'G-12': 1 } },
    },
    bandDistribution: { easy: 0, moderate: 2, hard: 0, very_hard: 0 },
    ...overrides,
  }
}

/** Round-trip through JSON so the parse under test is the parse a real upload gets. */
function parse(items: unknown[], summaryJson: unknown = summary()) {
  return parseBankFile(JSON.parse(JSON.stringify(items)), JSON.parse(JSON.stringify(summaryJson)))
}

const emptyState = (): ExistingBankState => ({
  itemIdByContentHash: new Map(),
  itemByFamilySeed: new Map(),
  familyIdByCode: new Map(),
})

// ---------------------------------------------------------------------------
// Recording fake store
// ---------------------------------------------------------------------------

type Recorded = {
  runs: GenerationRunInsert[]
  runFinishes: GenerationRunFinish[]
  families: FamilyInsert[]
  items: ItemInsert[]
  options: OptionInsert[][]
  itemSpecs: ItemSpecInsert[]
  optionSpecs: OptionSpecInsert[][]
  answerKeys: AnswerKeyInsert[]
  diagnostics: OptionDiagnosticInsert[][]
  exemplars: Array<[string, string]>
  deletedPartials: string[]
}

function fakeStore(existing: ExistingBankState = emptyState()): {
  store: ItemBankStore
  recorded: Recorded
  optionIdsByItem: Map<string, string[]>
} {
  const recorded: Recorded = {
    runs: [],
    runFinishes: [],
    families: [],
    items: [],
    options: [],
    itemSpecs: [],
    optionSpecs: [],
    answerKeys: [],
    diagnostics: [],
    deletedPartials: [],
    exemplars: [],
  }
  const optionIdsByItem = new Map<string, string[]>()
  let counter = 0
  const nextId = (prefix: string) => `${prefix}-${++counter}`

  const store: ItemBankStore = {
    async loadExistingState() {
      return existing
    },
    async createGenerationRun(row) {
      recorded.runs.push(row)
      return nextId('run')
    },
    async finishGenerationRun(_runId, patch) {
      recorded.runFinishes.push(patch)
    },
    async createFamily(row) {
      recorded.families.push(row)
      return nextId('family')
    },
    async createItem(row) {
      recorded.items.push(row)
      return nextId('item')
    },
    async createOptions(rows) {
      recorded.options.push([...rows])
      const ids = rows.map(() => nextId('option'))
      if (rows[0]) optionIdsByItem.set(rows[0].itemId, ids)
      return ids
    },
    async createItemSpec(row) {
      recorded.itemSpecs.push(row)
    },
    async createOptionSpecs(rows) {
      recorded.optionSpecs.push([...rows])
    },
    async createAnswerKey(row) {
      recorded.answerKeys.push(row)
    },
    async createOptionDiagnostics(rows) {
      recorded.diagnostics.push([...rows])
    },
    async setFamilyExemplar(familyId, itemId) {
      recorded.exemplars.push([familyId, itemId])
    },
    async deletePartialItemByContentHash(contentHash) {
      recorded.deletedPartials.push(contentHash)
    },
  }

  return { store, recorded, optionIdsByItem }
}

const ingestArgs = { constructId: 'construct-1', responseFormatId: 'format-1' }

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

describe('parseBankFile', () => {
  it('accepts a well-formed bank and preserves the verbatim qa blob', () => {
    const bank = parse([M1(), M6()])
    expect(bank.items).toHaveLength(2)
    expect(bank.items[0].familyCode).toBe('LRM-PROG-COUNT')
    expect(bank.items[0].options).toHaveLength(5)
    // rawQa keeps fields the validation schema does not model, so the stored
    // provenance is not silently narrowed.
    expect((bank.items[0].rawQa as Record<string, unknown>).admissibleRuleTuples).toEqual([])
  })

  it('rejects a spec carrying a key-shaped property', () => {
    // The DB has a CHECK for this (cognitive_item_specs_no_key); the zod
    // .strict() schema must refuse it before the row is ever built.
    const entry = M1() as unknown as { itemSpec: Record<string, unknown> }
    entry.itemSpec = { ...(entry.itemSpec as Record<string, unknown>), correctOption: 'B' }
    expect(() => parse([entry])).toThrow(BankFileError)
  })

  it('rejects an item with duplicate option slots', () => {
    // Five options with a repeated slot passes the array-length check but is
    // still malformed: one slot has no option, and item_options rows would be
    // ambiguous to join back to a spec.
    const entry = M1()
    entry.optionSpecs[4].slot = 'A'
    expect(() => parse([entry])).toThrow(/duplicate option slots/)
  })

  it('picks up optional per-distractor diagnostics when the file carries them', () => {
    const entry = bankEntry(m1ItemSpec, m1OptionSpecs, 'LRM-PROG-COUNT', 'unit-seed/LRM-PROG-COUNT/0', 'B', {
      A: { errorLabel: 'WR', rationale: 'applies the rule one step early' },
    })
    const bank = parse([entry])
    const optionA = bank.items[0].options.find((o) => o.slot === 'A')!
    expect(optionA.errorLabel).toBe('WR')
    expect(optionA.errorRationale).toBe('applies the rule one step early')
    // Absent on the others — the generator CLI does not currently emit them.
    expect(bank.items[0].options.find((o) => o.slot === 'C')!.errorLabel).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Planning — the idempotency decision
// ---------------------------------------------------------------------------

describe('buildIngestPlan', () => {
  it('plans every item and its family on a first ingest', () => {
    const bank = parse([M1(), M6()])
    const plan = buildIngestPlan(bank, emptyState())

    expect(plan.itemsToInsert).toHaveLength(2)
    expect(plan.familiesToCreate.map((f) => f.code).sort()).toEqual(['LRM-LATIN', 'LRM-PROG-COUNT'])
    expect(plan.skipped).toHaveLength(0)
    expect(plan.conflicts).toHaveLength(0)
    expect(plan.hashMismatches).toHaveLength(0)
  })

  it('names difficulty as a design prior, never as a measured difficulty', () => {
    const plan = buildIngestPlan(parse([M1()]), emptyState())
    const planned = plan.itemsToInsert[0]
    expect(planned.difficultyPriorB).toBe(0.42)
    expect(planned.difficultyPriorBand).toBe('moderate')
    // A field literally called `difficulty` would invite exactly the reading
    // this model cannot support (out-of-sample R² ~0.43).
    expect(Object.keys(planned)).not.toContain('difficulty')
    expect(Object.keys(planned)).not.toContain('predictedDifficulty')
    expect(Object.keys(plan.familiesToCreate[0])).not.toContain('difficulty')
  })

  it('skips every item on re-ingest of an identical bank', () => {
    const bank = parse([M1(), M6()])
    const existing: ExistingBankState = {
      itemIdByContentHash: new Map([
        [contentHash(m1ItemSpec), 'item-m1'],
        [contentHash(m6ItemSpec), 'item-m6'],
      ]),
      itemByFamilySeed: new Map([
        [familySeedKey('LRM-PROG-COUNT', 'unit-seed/LRM-PROG-COUNT/0'), { itemId: 'item-m1', contentHash: contentHash(m1ItemSpec) }],
        [familySeedKey('LRM-LATIN', 'unit-seed/LRM-LATIN/0'), { itemId: 'item-m6', contentHash: contentHash(m6ItemSpec) }],
      ]),
      familyIdByCode: new Map([
        ['LRM-PROG-COUNT', 'family-1'],
        ['LRM-LATIN', 'family-2'],
      ]),
    }

    const plan = buildIngestPlan(bank, existing)
    expect(plan.itemsToInsert).toHaveLength(0)
    expect(plan.skipped.map((s) => s.existingItemId)).toEqual(['item-m1', 'item-m6'])
    expect(plan.familiesToCreate).toHaveLength(0)
  })

  it('refuses a changed item that reuses an existing (family, seed) identity', () => {
    const bank = parse([M1()])
    const existing = emptyState()
    const state: ExistingBankState = {
      ...existing,
      itemByFamilySeed: new Map([
        [
          familySeedKey('LRM-PROG-COUNT', 'unit-seed/LRM-PROG-COUNT/0'),
          { itemId: 'item-old', contentHash: 'sha256:something-else' },
        ],
      ]),
    }

    const plan = buildIngestPlan(bank, state)
    expect(plan.itemsToInsert).toHaveLength(0)
    expect(plan.conflicts).toEqual([
      {
        familyCode: 'LRM-PROG-COUNT',
        generatorSeed: 'unit-seed/LRM-PROG-COUNT/0',
        existingItemId: 'item-old',
        existingContentHash: 'sha256:something-else',
        incomingContentHash: contentHash(m1ItemSpec),
      },
    ])
  })

  it('refuses an item whose stated hash disagrees with its own spec', () => {
    const entry = M1()
    entry.qa.contentHash = 'sha256:tampered'
    const plan = buildIngestPlan(parse([entry]), emptyState())

    expect(plan.itemsToInsert).toHaveLength(0)
    expect(plan.hashMismatches).toEqual([
      {
        familyCode: 'LRM-PROG-COUNT',
        generatorSeed: 'unit-seed/LRM-PROG-COUNT/0',
        stated: 'sha256:tampered',
        recomputed: contentHash(m1ItemSpec),
      },
    ])
  })

  it('catches an item duplicated inside a single bank file', () => {
    const plan = buildIngestPlan(parse([M1(), M1()]), emptyState())
    expect(plan.itemsToInsert).toHaveLength(1)
    expect(plan.conflicts).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

describe('ingestGeneratedBank', () => {
  it('writes the item, its options, both specs and the key, in FK order', async () => {
    const { store, recorded, optionIdsByItem } = fakeStore()
    const result = await ingestGeneratedBank(store, { bank: parse([M1()]), ...ingestArgs })

    expect(result.itemsInserted).toBe(1)
    expect(result.familiesCreated).toBe(1)
    expect(recorded.runs).toHaveLength(1)
    expect(recorded.runs[0].seed).toBe('unit-seed')
    expect(recorded.items).toHaveLength(1)
    expect(recorded.options[0]).toHaveLength(5)
    expect(recorded.itemSpecs).toHaveLength(1)
    expect(recorded.optionSpecs[0]).toHaveLength(5)
    expect(recorded.answerKeys).toHaveLength(1)

    // The key must be the option in the slot the bank named (M1's key is B,
    // the second of five options ordered A..E).
    const itemId = recorded.itemSpecs[0].itemId
    const optionIds = optionIdsByItem.get(itemId)!
    expect(recorded.answerKeys[0].correctOptionId).toBe(optionIds[1])

    // Provenance: the spec row carries the seed and the run.
    expect(recorded.itemSpecs[0].generatorSeed).toBe('unit-seed/LRM-PROG-COUNT/0')
    expect(recorded.itemSpecs[0].generationRunId).toBe(recorded.answerKeys[0] ? 'run-1' : '')
    expect(recorded.itemSpecs[0].contentHash).toBe(contentHash(m1ItemSpec))

    // The run's QA summary carries the pass/fail tallies and reject reasons
    // #347 scope item 5 asks for.
    const finish = recorded.runFinishes.at(-1)!
    expect(finish.status).toBe('succeeded')
    expect(finish.qaSummary).toMatchObject({
      gates: { 'G-01': { pass: 1, fail: 0, skip: 0 }, 'G-06': { pass: 0, fail: 0, skip: 1 } },
      rejectionReasons: { 'G-08': 1, 'G-12': 1 },
    })

    // The first item of a newly created family becomes its exemplar.
    expect(recorded.exemplars).toHaveLength(1)
  })

  it('writes no diagnostics rows when the bank carries no error labels', async () => {
    const { store, recorded } = fakeStore()
    await ingestGeneratedBank(store, { bank: parse([M1()]), ...ingestArgs })
    expect(recorded.diagnostics[0]).toEqual([])
  })

  it('writes a diagnostics row for each labelled distractor', async () => {
    const entry = bankEntry(m1ItemSpec, m1OptionSpecs, 'LRM-PROG-COUNT', 'unit-seed/LRM-PROG-COUNT/0', 'B', {
      A: { errorLabel: 'WR', rationale: 'wrong rule' },
      C: { errorLabel: 'IR' },
    })
    const { store, recorded } = fakeStore()
    await ingestGeneratedBank(store, { bank: parse([entry]), ...ingestArgs })

    expect(recorded.diagnostics[0].map((d) => d.errorLabel)).toEqual(['WR', 'IR'])
    expect(recorded.diagnostics[0][0].rationale).toBe('wrong rule')
    expect(recorded.diagnostics[0][1].rationale).toBeNull()
  })

  it('writes NOTHING — not even a run row — when the bank is already fully present', async () => {
    const existing: ExistingBankState = {
      itemIdByContentHash: new Map([[contentHash(m1ItemSpec), 'item-m1']]),
      itemByFamilySeed: new Map([
        [
          familySeedKey('LRM-PROG-COUNT', 'unit-seed/LRM-PROG-COUNT/0'),
          { itemId: 'item-m1', contentHash: contentHash(m1ItemSpec) },
        ],
      ]),
      familyIdByCode: new Map([['LRM-PROG-COUNT', 'family-1']]),
    }
    const { store, recorded } = fakeStore(existing)
    const result = await ingestGeneratedBank(store, { bank: parse([M1()]), ...ingestArgs })

    expect(result).toMatchObject({
      generationRunId: null,
      itemsInserted: 0,
      itemsSkipped: 1,
      wroteAnything: false,
    })
    expect(recorded.runs).toEqual([])
    expect(recorded.items).toEqual([])
    expect(recorded.families).toEqual([])
  })

  it('refuses a conflicting bank before writing anything at all', async () => {
    const existing: ExistingBankState = {
      ...emptyState(),
      itemByFamilySeed: new Map([
        [
          familySeedKey('LRM-PROG-COUNT', 'unit-seed/LRM-PROG-COUNT/0'),
          { itemId: 'item-old', contentHash: 'sha256:different' },
        ],
      ]),
    }
    const { store, recorded } = fakeStore(existing)

    // Two items in the bank; only one conflicts. The clean one must NOT be
    // written — refusal is all-or-nothing.
    await expect(
      ingestGeneratedBank(store, { bank: parse([M1(), M6()]), ...ingestArgs }),
    ).rejects.toBeInstanceOf(BankIngestConflictError)

    expect(recorded.runs).toEqual([])
    expect(recorded.items).toEqual([])
    expect(recorded.families).toEqual([])
    expect(recorded.answerKeys).toEqual([])
  })

  it('re-ingest after a partial bank inserts only the new items', async () => {
    const existing: ExistingBankState = {
      itemIdByContentHash: new Map([[contentHash(m1ItemSpec), 'item-m1']]),
      itemByFamilySeed: new Map([
        [
          familySeedKey('LRM-PROG-COUNT', 'unit-seed/LRM-PROG-COUNT/0'),
          { itemId: 'item-m1', contentHash: contentHash(m1ItemSpec) },
        ],
      ]),
      familyIdByCode: new Map([['LRM-PROG-COUNT', 'family-1']]),
    }
    const { store, recorded } = fakeStore(existing)
    const result = await ingestGeneratedBank(store, { bank: parse([M1(), M6()]), ...ingestArgs })

    expect(result.itemsInserted).toBe(1)
    expect(result.itemsSkipped).toBe(1)
    // Only the family the new item needs; the existing one is left untouched.
    expect(recorded.families.map((f) => f.code)).toEqual(['LRM-LATIN'])
  })

  it('removes the half-written item when a child write fails', async () => {
    // There is no transaction around an item's several writes. Without this
    // cleanup the `items` row survives, and because the idempotency decision is
    // content-hash-only, every later run skips it — so the answer key it is
    // missing can never be written. "Re-run to complete a partial load" would
    // silently not apply to that one item.
    const { store, recorded } = fakeStore()
    const failing: ItemBankStore = {
      ...store,
      async createAnswerKey() {
        throw new Error('connection reset')
      },
    }

    await expect(
      ingestGeneratedBank(failing, { bank: parse([M1()]), ...ingestArgs }),
    ).rejects.toThrow('connection reset')

    expect(recorded.deletedPartials).toEqual([contentHash(m1ItemSpec)])
    // The run is closed out as failed rather than left running.
    expect(recorded.runFinishes.at(-1)?.status).toBe('failed')
  })

  it('does not let a cleanup failure mask the real error', async () => {
    const { store } = fakeStore()
    const failing: ItemBankStore = {
      ...store,
      async createAnswerKey() {
        throw new Error('the error worth reading')
      },
      async deletePartialItemByContentHash() {
        throw new Error('cleanup also failed')
      },
    }

    // The contract says implementations must not throw; if one does anyway, the
    // original error is still the one that surfaces.
    await expect(
      ingestGeneratedBank(failing, { bank: parse([M1()]), ...ingestArgs }),
    ).rejects.toThrow('the error worth reading')
  })
})
