/**
 * `bankFromGeneration` is the join between the generator and ingest, and it now
 * has three callers: the CLI generator, the live loader, and the admin
 * "generate and ingest" action.
 *
 * The invariant that matters is that they cannot drift. Ingest decides what is
 * already present by content hash, so if the UI shaped a bank even slightly
 * differently from the CLI, re-running a seed would stop skipping and start
 * inserting duplicates — silently, because both banks would be individually
 * valid. These tests pin the shape and the determinism rather than the
 * formatting.
 */

import { describe, expect, it } from 'vitest'
import { generateBatch } from '@/lib/cognitive/generator/index'
import { ALL_FAMILIES } from '@/lib/cognitive/generator/families/index'
import { bankFromGeneration } from '@/lib/item-bank/from-generation'

const SEED = 'from-generation-test'
const PER_FAMILY = 2
const FIXED = { startedAt: '2026-08-15T00:00:00.000Z', finishedAt: '2026-08-15T00:00:10.000Z' }

function build(seed = SEED, perFamily = PER_FAMILY) {
  const result = generateBatch(ALL_FAMILIES, seed, perFamily)
  return bankFromGeneration(result, ALL_FAMILIES, { seed, perFamily, ...FIXED })
}

describe('bankFromGeneration', () => {
  it('produces a bank that parseBankFile accepts', () => {
    const bank = build()
    expect(bank.items.length).toBeGreaterThan(0)
    expect(bank.summary.seed).toBe(SEED)
    expect(bank.summary.perFamilyRequested).toBe(PER_FAMILY)
  })

  it('is deterministic in everything ingest reads', () => {
    const a = build()
    const b = build()

    // Content hash is the identity ingest keys on. If these ever diverge for a
    // fixed seed, re-running a seed stops skipping and starts duplicating.
    expect(a.items.map((i) => i.qa.contentHash)).toEqual(b.items.map((i) => i.qa.contentHash))
    expect(a.items.map((i) => i.qa.structuralHash)).toEqual(b.items.map((i) => i.qa.structuralHash))
    expect(a.items.map((i) => i.generatorSeed)).toEqual(b.items.map((i) => i.generatorSeed))
    expect(a.items.map((i) => i.keySlot)).toEqual(b.items.map((i) => i.keySlot))
    expect(a.items.map((i) => i.itemSpec)).toEqual(b.items.map((i) => i.itemSpec))
    expect(a.items.map((i) => i.options)).toEqual(b.items.map((i) => i.options))
    expect(a.summary).toEqual(b.summary)
  })

  it('differs between runs only in the wall-clock stamp', () => {
    // `qa.passedAt` is when the battery ran, not a property of the item, so it
    // moves between runs by design. Nothing else may. Asserting the exhaustive
    // list here means a newly introduced non-deterministic field fails loudly
    // rather than quietly breaking idempotency.
    const strip = (bank: ReturnType<typeof build>) =>
      JSON.parse(
        JSON.stringify(bank, (key, value) => (key === 'passedAt' ? '<stamp>' : value)),
      ) as unknown

    expect(strip(build())).toEqual(strip(build()))
  })

  it('distinguishes seeds', () => {
    const a = build(SEED)
    const b = build(`${SEED}-other`)
    const hashesA = a.items.map((i) => i.qa.contentHash).sort()
    const hashesB = b.items.map((i) => i.qa.contentHash).sort()
    expect(hashesA).not.toEqual(hashesB)
  })

  it('reports every family, including ones that accepted nothing', () => {
    const bank = build()
    for (const family of ALL_FAMILIES) {
      expect(bank.summary.perFamily[family.code]).toBeDefined()
    }
    expect(Object.keys(bank.summary.perFamily).length).toBe(ALL_FAMILIES.length)
  })

  it('accepted counts and totals agree with the items actually returned', () => {
    const bank = build()
    const summed = Object.values(bank.summary.perFamily).reduce((a, f) => a + f.accepted, 0)
    expect(summed).toBe(bank.items.length)
    expect(bank.summary.totalAccepted).toBe(bank.items.length)

    for (const [code, stats] of Object.entries(bank.summary.perFamily)) {
      const actual = bank.items.filter((i) => i.familyCode === code).length
      expect(stats.accepted).toBe(actual)
      // Nothing can be accepted that was never attempted.
      expect(stats.attempted).toBeGreaterThanOrEqual(stats.accepted)
    }
  })

  it('names every difficulty band even at zero, so an absent band is not a missing key', () => {
    const bank = build()
    for (const band of ['easy', 'moderate', 'hard', 'very_hard']) {
      expect(bank.summary.bandDistribution[band]).toBeTypeOf('number')
    }
    const summed = Object.values(bank.summary.bandDistribution).reduce((a, b) => a + b, 0)
    expect(summed).toBe(bank.items.length)
  })

  it('carries each item’s own content hash through untouched', () => {
    const result = generateBatch(ALL_FAMILIES, SEED, PER_FAMILY)
    const bank = bankFromGeneration(result, ALL_FAMILIES, { seed: SEED, perFamily: PER_FAMILY, ...FIXED })
    expect(bank.items.map((i) => i.qa.contentHash)).toEqual(result.items.map((i) => i.qa.contentHash))
  })

  it('carries a distractor rationale for every option that is not the key', () => {
    const bank = build()
    for (const item of bank.items) {
      const distractors = item.options.filter((o) => o.slot !== item.keySlot)
      expect(distractors).toHaveLength(4)
      for (const option of distractors) {
        // Without these the review UI renders four indistinguishable wrong
        // answers, and a content reviewer has nothing to check the design
        // against. The generator has always produced them; they used to be
        // dropped between the generator and the bank file.
        expect(option.errorLabel).not.toBeNull()
        expect(option.errorRationale).toBeTruthy()
      }
      const key = item.options.find((o) => o.slot === item.keySlot)
      expect(key?.errorLabel ?? null).toBeNull()
    }
  })

  it('keeps the rationale out of the participant-visible option spec', () => {
    // `spec` is what reaches the browser during delivery. The mechanism that
    // makes an option wrong is a description of the answer; if it appeared
    // here it would be shipped alongside the question.
    const bank = build()
    for (const item of bank.items) {
      for (const option of item.options) {
        const keys = Object.keys(option.spec as Record<string, unknown>)
        expect(keys).not.toContain('errorLabel')
        expect(keys).not.toContain('rationale')
        expect(JSON.stringify(option.spec)).not.toContain('errorLabel')
      }
    }
  })

  it('adding diagnostics did not disturb the content hashes', () => {
    // Content hash covers the item spec only. If diagnostics ever entered it,
    // every previously ingested item would re-ingest as new — which would
    // duplicate the bank already in production rather than completing it.
    const bank = build('pilot-2026-08-13', 1)
    const first = bank.items.find((i) => i.familyCode === 'LRM-PROG-COUNT')
    expect(first?.qa.contentHash).toBe(
      'sha256:61e5e72331e72da7ce56e15a4bbc61f66116c46606de154d211bb8c266868c92',
    )
  })

  it('survives the JSON round trip that a file upload would impose', () => {
    const bank = build()
    // No undefined holes, no class instances — anything a file could not carry
    // would have been dropped by the round trip inside bankFromGeneration.
    expect(JSON.parse(JSON.stringify(bank.items))).toEqual(bank.items)
    expect(JSON.parse(JSON.stringify(bank.summary))).toEqual(bank.summary)
  })
})
