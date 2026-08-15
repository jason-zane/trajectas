/**
 * Bank-ingest round trip against a REAL PostgreSQL database (LR-8 / #347).
 *
 * Acceptance for #347 is "a generated bank can be ingested and re-ingested
 * without duplication". This harness demonstrates it rather than asserting it:
 * it generates a bank, ingests it, ingests the identical bank a second time,
 * and prints the row counts of every table ingest touches after each pass.
 *
 * WHY IT TALKS TO psql AND NOT SUPABASE. Ingest's production store speaks
 * PostgREST via the Supabase client, which needs a running Supabase stack,
 * which needs Docker — unavailable in the environment this was written in
 * (see scripts/README-pg-migrate-check.md). `scripts/pg-migrate-check.sh` puts
 * up a throwaway Postgres 16 cluster with EVERY migration applied, which is
 * the part that matters here: the real triggers
 * (items_lifecycle_guard, forbid_option_keys_on_cognitive_items,
 * items_review_signoff_guard), the real CHECK constraints
 * (cognitive_item_specs_no_key, cognitive_item_specs_shape), the real
 * composite FK on item_answer_keys, and the real
 * items_live_content_hash_unique index all fire.
 *
 * It implements `ItemBankStore` (src/lib/item-bank/store.ts) over psql, so the
 * ORCHESTRATION and the IDEMPOTENCY DECISION under test are the production
 * ones, imported directly. What is NOT covered is the Supabase store's own
 * PostgREST calls; `npm run test:integration:local` covers those when a
 * Docker-capable machine is available.
 *
 * Usage:
 *   scripts/pg-migrate-check.sh --fresh --keep-running
 *   node --import ./scripts/cognitive/register-ts-loader.mjs \
 *     scripts/cognitive/ingest-roundtrip.ts --host=<socket-dir> [--port=55432]
 */
import { execFileSync } from 'node:child_process'
import { generateBatch, type GeneratedItem } from '@/lib/cognitive/generator/index'
import { ALL_FAMILIES } from '@/lib/cognitive/generator/families/index'
import { parseBankFile } from '@/lib/item-bank/bank-file'
import { ingestGeneratedBank, BankIngestConflictError } from '@/lib/item-bank/ingest'
import { familySeedKey, type ExistingBankState } from '@/lib/item-bank/plan'
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

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const arg of argv) {
    const m = /^--([a-zA-Z-]+)(?:=(.*))?$/.exec(arg)
    if (m) out[m[1]] = m[2] ?? 'true'
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
const HOST = args.host ?? `${process.env.TMPDIR ?? '/tmp'}/pg-migrate-check/run`
const PORT = args.port ?? '55432'
const PER_FAMILY = Number.parseInt(args['per-family'] ?? '2', 10)
const SEED = args.seed ?? 'pilot-2026-08-13'

function sql(text: string): string {
  return execFileSync('psql', ['-h', HOST, '-p', PORT, '-U', 'postgres', '-d', 'postgres', '-tAqc', text], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).trim()
}

/** Single-quoted SQL literal, or NULL. */
function lit(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return `'${value.replace(/'/g, "''")}'`
}

function jsonb(value: unknown): string {
  if (value === undefined) return 'NULL'
  return `${lit(JSON.stringify(value))}::jsonb`
}

function textArray(values: readonly string[]): string {
  return `ARRAY[${values.map(lit).join(',') || ''}]::text[]`
}

// ---------------------------------------------------------------------------
// psql-backed ItemBankStore
// ---------------------------------------------------------------------------
function createPsqlStore(): ItemBankStore {
  return {
    async loadExistingState(familyCodes: readonly string[], contentHashes: readonly string[]): Promise<ExistingBankState> {
      const familyIdByCode = new Map<string, string>()
      const itemIdByContentHash = new Map<string, string>()
      const itemByFamilySeed = new Map<string, { itemId: string; contentHash: string | null }>()

      if (familyCodes.length > 0) {
        const rows = sql(
          `SELECT id || '|' || code FROM item_families WHERE code = ANY(${textArray(familyCodes)})`,
        )
        for (const line of rows.split('\n').filter(Boolean)) {
          const [id, code] = line.split('|')
          familyIdByCode.set(code, id)
        }
      }

      if (contentHashes.length > 0) {
        const rows = sql(
          `SELECT id || '|' || content_hash FROM items
             WHERE content_hash = ANY(${textArray(contentHashes)}) AND deleted_at IS NULL`,
        )
        for (const line of rows.split('\n').filter(Boolean)) {
          const [id, hash] = line.split('|')
          itemIdByContentHash.set(hash, id)
        }
      }

      const familyIds = [...familyIdByCode.values()]
      if (familyIds.length > 0) {
        const rows = sql(
          `SELECT f.code || '|' || s.generator_seed || '|' || i.id || '|' || coalesce(i.content_hash,'')
             FROM cognitive_item_specs s
             JOIN items i ON i.id = s.item_id
             JOIN item_families f ON f.id = i.family_id
            WHERE i.family_id = ANY(${textArray(familyIds)}::uuid[])
              AND i.deleted_at IS NULL AND s.generator_seed IS NOT NULL`,
        )
        for (const line of rows.split('\n').filter(Boolean)) {
          const [code, seed, itemId, hash] = line.split('|')
          itemByFamilySeed.set(familySeedKey(code, seed), { itemId, contentHash: hash || null })
        }
      }

      return { familyIdByCode, itemIdByContentHash, itemByFamilySeed }
    },

    async createGenerationRun(row: GenerationRunInsert): Promise<string> {
      return sql(
        `INSERT INTO cognitive_generation_runs
           (kind, generator_name, generator_version, git_sha, seed, params, status, requested_by, started_at)
         VALUES (${lit(row.kind)}::cognitive_spec_kind, ${lit(row.generatorName)}, ${lit(row.generatorVersion)},
                 ${lit(row.gitSha)}, ${lit(row.seed)}, ${jsonb(row.params)}, 'running',
                 ${lit(row.requestedByProfileId)}::uuid, ${lit(row.startedAt)}::timestamptz)
         RETURNING id`,
      )
    },

    async finishGenerationRun(runId: string, patch: GenerationRunFinish): Promise<void> {
      sql(
        `UPDATE cognitive_generation_runs SET
            status = ${lit(patch.status)}, items_proposed = ${patch.itemsProposed},
            items_accepted = ${patch.itemsAccepted}, items_rejected = ${patch.itemsRejected},
            qa_summary = ${jsonb(patch.qaSummary)}, error_message = ${lit(patch.errorMessage)},
            completed_at = ${lit(patch.completedAt)}::timestamptz
          WHERE id = ${lit(runId)}::uuid`,
      )
    },

    async createFamily(row: FamilyInsert): Promise<string> {
      return sql(
        `INSERT INTO item_families (code, construct_id, kind, rules, radicals, predicted_b, band, notes)
         VALUES (${lit(row.code)}, ${lit(row.constructId)}::uuid, ${lit(row.kind)}, ${jsonb(row.rules)},
                 ${jsonb(row.radicals)}, ${row.difficultyPriorB}, ${lit(row.difficultyPriorBand)}, ${lit(row.notes)})
         RETURNING id`,
      )
    },

    async createItem(row: ItemInsert): Promise<string> {
      return sql(
        `INSERT INTO items (response_format_id, construct_id, family_id, stem, purpose, difficulty,
                            content_hash, display_order, status, lifecycle_state)
         VALUES (${lit(row.responseFormatId)}::uuid, ${lit(row.constructId)}::uuid, ${lit(row.familyId)}::uuid,
                 ${lit(row.stem)}, ${lit(row.purpose)}::item_purpose, ${lit(row.difficulty)}::item_difficulty,
                 ${lit(row.contentHash)}, ${row.displayOrder}, 'draft', 'draft')
         RETURNING id`,
      )
    },

    async createOptions(rows: readonly OptionInsert[]): Promise<string[]> {
      const values = rows
        .map(
          (r) =>
            `(${lit(r.itemId)}::uuid, ${lit(r.label)}, ${r.value}, ${r.displayOrder}, NULL)`,
        )
        .join(',')
      const out = sql(
        `INSERT INTO item_options (item_id, label, value, display_order, score_value)
         VALUES ${values} RETURNING display_order || '|' || id`,
      )
      const byOrder = new Map<number, string>()
      for (const line of out.split('\n').filter(Boolean)) {
        const [order, id] = line.split('|')
        byOrder.set(Number(order), id)
      }
      return rows.map((r) => {
        const id = byOrder.get(r.displayOrder)
        if (!id) throw new Error(`no option id returned for display_order ${r.displayOrder}`)
        return id
      })
    },

    async createItemSpec(row: ItemSpecInsert): Promise<void> {
      sql(
        `INSERT INTO cognitive_item_specs (item_id, kind, spec, generation_run_id, generator_seed, qa, content_hash)
         VALUES (${lit(row.itemId)}::uuid, ${lit(row.kind)}::cognitive_spec_kind, ${jsonb(row.spec)},
                 ${lit(row.generationRunId)}::uuid, ${lit(row.generatorSeed)}, ${jsonb(row.qa)}, ${lit(row.contentHash)})`,
      )
    },

    async createOptionSpecs(rows: readonly OptionSpecInsert[]): Promise<void> {
      if (rows.length === 0) return
      const values = rows
        .map((r) => `(${lit(r.optionId)}::uuid, ${lit(r.itemId)}::uuid, ${jsonb(r.spec)})`)
        .join(',')
      sql(`INSERT INTO cognitive_option_specs (option_id, item_id, spec) VALUES ${values}`)
    },

    async createAnswerKey(row: AnswerKeyInsert): Promise<void> {
      sql(
        `INSERT INTO item_answer_keys (item_id, correct_option_id, rationale, created_by)
         VALUES (${lit(row.itemId)}::uuid, ${lit(row.correctOptionId)}::uuid, ${lit(row.rationale)},
                 ${lit(row.createdByProfileId)}::uuid)`,
      )
    },

    async createOptionDiagnostics(rows: readonly OptionDiagnosticInsert[]): Promise<void> {
      if (rows.length === 0) return
      const values = rows
        .map(
          (r) =>
            `(${lit(r.optionId)}::uuid, ${lit(r.itemId)}::uuid, ${lit(r.errorLabel)}, ${lit(r.rationale)})`,
        )
        .join(',')
      sql(`INSERT INTO item_option_diagnostics (option_id, item_id, error_label, rationale) VALUES ${values}`)
    },

    async setFamilyExemplar(familyId: string, itemId: string): Promise<void> {
      sql(`UPDATE item_families SET exemplar_item_id = ${lit(itemId)}::uuid WHERE id = ${lit(familyId)}::uuid`)
    },
  }
}

// ---------------------------------------------------------------------------
// Fixtures the bank needs to hang off (a construct + a cognitive response
// format + a reviewer profile). Idempotent so the script can be re-run.
// ---------------------------------------------------------------------------
const FIXTURE = {
  partnerId: '9f000000-0000-0000-0000-0000000000a1',
  constructId: '286a8eac-88b0-4a61-90ca-123678a39e00', // prod: Analytical Thinking
  reviewerId: '9f000000-0000-0000-0000-0000000000a3',
  fairnessReviewerId: '9f000000-0000-0000-0000-0000000000a4',
  responseFormatId: 'a5000000-0000-0000-0000-000000000009', // prod: Figural Matrix (5-option), type=cognitive
}

function seedFixtures(): void {
  sql(`INSERT INTO partners (id, name, slug) VALUES (${lit(FIXTURE.partnerId)}::uuid, 'Roundtrip Partner', 'roundtrip-partner')
       ON CONFLICT (id) DO NOTHING`)
  sql(`INSERT INTO constructs (id, partner_id, name, slug)
       VALUES (${lit(FIXTURE.constructId)}::uuid, NULL, 'Analytical Thinking', 'analytical-thinking')
       ON CONFLICT (id) DO NOTHING`)
  for (const [id, email] of [
    [FIXTURE.reviewerId, 'content-reviewer@example.com'],
    [FIXTURE.fairnessReviewerId, 'fairness-reviewer@example.com'],
  ] as const) {
    sql(`INSERT INTO auth.users (id) VALUES (${lit(id)}::uuid) ON CONFLICT (id) DO NOTHING`)
    sql(`INSERT INTO profiles (id, email, role) VALUES (${lit(id)}::uuid, ${lit(email)}, 'platform_admin')
         ON CONFLICT (id) DO NOTHING`)
  }
}

function counts(): Record<string, number> {
  const tables = [
    'item_families',
    'items',
    'item_options',
    'cognitive_item_specs',
    'cognitive_option_specs',
    'item_answer_keys',
    'item_option_diagnostics',
    'cognitive_generation_runs',
    'item_reviews',
  ]
  const out: Record<string, number> = {}
  for (const table of tables) out[table] = Number(sql(`SELECT count(*) FROM ${table}`))
  return out
}

function sameCounts(a: Record<string, number>, b: Record<string, number>): boolean {
  return Object.keys(a).every((k) => a[k] === b[k])
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  seedFixtures()

  const result = generateBatch(ALL_FAMILIES, SEED, PER_FAMILY)
  const itemsJson = result.items.map((item: GeneratedItem) => ({
    familyCode: item.familyCode,
    seed: item.seed,
    keySlot: item.keySlot,
    itemSpec: item.itemSpec,
    optionSpecs: item.optionSpecs,
    qa: item.qa,
  }))
  const bandDistribution: Record<string, number> = { easy: 0, moderate: 0, hard: 0, very_hard: 0 }
  for (const item of result.items) bandDistribution[item.qa.band]++
  const summaryJson = {
    generatorVersion: result.items[0]?.qa.generatorVersion ?? null,
    batteryVersion: result.items[0]?.qa.batteryVersion ?? null,
    seed: SEED,
    perFamilyRequested: PER_FAMILY,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    totalAttempted: Object.values(result.attempted).reduce((a: number, b: number) => a + b, 0),
    totalAccepted: result.items.length,
    perFamily: Object.fromEntries(
      ALL_FAMILIES.map((f) => [
        f.code,
        {
          attempted: result.attempted[f.code],
          accepted: result.items.filter((i) => i.familyCode === f.code).length,
          rejects: result.rejects[f.code],
        },
      ]),
    ),
    bandDistribution,
  }

  // Round-trip the JSON exactly as the file would, so the parse under test is
  // the parse a real upload gets.
  const bank = parseBankFile(JSON.parse(JSON.stringify(itemsJson)), JSON.parse(JSON.stringify(summaryJson)))
  console.log(`Generated ${bank.items.length} items across ${new Set(bank.items.map((i) => i.familyCode)).size} families.`)

  const store = createPsqlStore()
  const before = counts()
  console.log('\nBEFORE      ', JSON.stringify(before))

  const first = await ingestGeneratedBank(store, {
    bank,
    constructId: FIXTURE.constructId,
    responseFormatId: FIXTURE.responseFormatId,
    requestedByProfileId: FIXTURE.reviewerId,
  })
  const afterFirst = counts()
  console.log('PASS 1      ', JSON.stringify(first))
  console.log('AFTER PASS 1', JSON.stringify(afterFirst))

  const second = await ingestGeneratedBank(store, {
    bank,
    constructId: FIXTURE.constructId,
    responseFormatId: FIXTURE.responseFormatId,
    requestedByProfileId: FIXTURE.reviewerId,
  })
  const afterSecond = counts()
  console.log('PASS 2      ', JSON.stringify(second))
  console.log('AFTER PASS 2', JSON.stringify(afterSecond))

  let ok = true
  if (first.itemsInserted !== bank.items.length) {
    console.error(`FAIL: pass 1 inserted ${first.itemsInserted}, expected ${bank.items.length}`)
    ok = false
  }
  if (second.itemsInserted !== 0 || second.wroteAnything) {
    console.error('FAIL: pass 2 wrote something')
    ok = false
  }
  if (second.itemsSkipped !== bank.items.length) {
    console.error(`FAIL: pass 2 skipped ${second.itemsSkipped}, expected ${bank.items.length}`)
    ok = false
  }
  if (!sameCounts(afterFirst, afterSecond)) {
    console.error('FAIL: row counts changed between pass 1 and pass 2')
    ok = false
  }

  // A changed item under an existing (family, seed) must be refused outright.
  const mutated = structuredClone(bank)
  const victim = mutated.items[0]
  victim.itemSpec.rules[0].statement = `${victim.itemSpec.rules[0].statement} (edited)`
  const { contentHash } = await import('@/lib/cognitive/spec/hash')
  victim.qa.contentHash = contentHash(victim.itemSpec)
  const countsBeforeConflict = counts()
  try {
    await ingestGeneratedBank(store, {
      bank: mutated,
      constructId: FIXTURE.constructId,
      responseFormatId: FIXTURE.responseFormatId,
      requestedByProfileId: FIXTURE.reviewerId,
    })
    console.error('FAIL: a changed item sharing an identity was accepted')
    ok = false
  } catch (error) {
    if (error instanceof BankIngestConflictError) {
      console.log(`\nCONFLICT    refused as designed: ${error.message}`)
    } else {
      console.error('FAIL: unexpected error type', error)
      ok = false
    }
  }
  if (!sameCounts(countsBeforeConflict, counts())) {
    console.error('FAIL: the refused ingest wrote rows')
    ok = false
  }

  // ------------------------------------------------------------------
  // Lifecycle + sign-off guard (migration 20260814110000).
  // ------------------------------------------------------------------
  const itemId = first.insertedItemIds[0]
  const checks: Array<[string, () => void]> = [
    [
      'draft -> content_reviewed is refused with no content sign-off',
      () => expectFailure(`UPDATE items SET lifecycle_state='content_reviewed' WHERE id=${lit(itemId)}::uuid`, 'no content review'),
    ],
    [
      'draft -> fairness_reviewed is refused by the transition graph',
      () => expectFailure(`UPDATE items SET lifecycle_state='fairness_reviewed' WHERE id=${lit(itemId)}::uuid`, 'illegal item lifecycle transition'),
    ],
  ]
  for (const [label, run] of checks) {
    try {
      run()
      console.log(`GUARD OK    ${label}`)
    } catch (error) {
      console.error(`FAIL: ${label} — ${(error as Error).message}`)
      ok = false
    }
  }

  sql(`INSERT INTO item_reviews (item_id, review_kind, decision, reviewer_profile_id)
       VALUES (${lit(itemId)}::uuid, 'content', 'approved', ${lit(FIXTURE.reviewerId)}::uuid)`)
  sql(`UPDATE items SET lifecycle_state='content_reviewed' WHERE id=${lit(itemId)}::uuid`)
  console.log('GUARD OK    content sign-off recorded -> draft -> content_reviewed succeeds')

  try {
    expectFailure(
      `UPDATE items SET lifecycle_state='fairness_reviewed' WHERE id=${lit(itemId)}::uuid`,
      'no fairness review',
    )
    console.log('GUARD OK    content_reviewed -> fairness_reviewed is refused with no fairness sign-off')
  } catch (error) {
    console.error(`FAIL: ${(error as Error).message}`)
    ok = false
  }

  sql(`INSERT INTO item_reviews (item_id, review_kind, decision, reviewer_profile_id)
       VALUES (${lit(itemId)}::uuid, 'fairness', 'approved', ${lit(FIXTURE.fairnessReviewerId)}::uuid)`)
  sql(`UPDATE items SET lifecycle_state='fairness_reviewed' WHERE id=${lit(itemId)}::uuid`)
  const actors = sql(
    `SELECT review_kind || '=' || reviewer_profile_id || '@' || created_at
       FROM item_reviews WHERE item_id=${lit(itemId)}::uuid ORDER BY review_kind`,
  )
  console.log('GUARD OK    both sign-offs recorded -> content_reviewed -> fairness_reviewed succeeds')
  console.log(`            separate actors + timestamps: ${actors.replace(/\n/g, ' | ')}`)

  // A rejection after an approval revokes it.
  sql(`INSERT INTO item_reviews (item_id, review_kind, decision, reviewer_profile_id)
       VALUES (${lit(itemId)}::uuid, 'fairness', 'rejected', ${lit(FIXTURE.fairnessReviewerId)}::uuid)`)
  try {
    expectFailure(
      `UPDATE items SET lifecycle_state='piloting' WHERE id=${lit(itemId)}::uuid`,
      'standing fairness review is a rejection',
    )
    console.log('GUARD OK    a later rejection revokes the standing fairness approval')
  } catch (error) {
    console.error(`FAIL: ${(error as Error).message}`)
    ok = false
  }

  // Append-only.
  try {
    expectFailure(
      `UPDATE item_reviews SET decision='approved' WHERE item_id=${lit(itemId)}::uuid`,
      'append-only',
    )
    console.log('GUARD OK    item_reviews rejects UPDATE (append-only)')
  } catch (error) {
    console.error(`FAIL: ${(error as Error).message}`)
    ok = false
  }

  console.log(`\nRESULT: ${ok ? 'PASS' : 'FAIL'}`)
  if (!ok) process.exitCode = 1
}

/** Run a statement expected to raise, asserting the message contains `fragment`. */
function expectFailure(statement: string, fragment: string): void {
  let raised: string | null = null
  try {
    sql(statement)
  } catch (error) {
    raised = String((error as { stderr?: Buffer }).stderr ?? (error as Error).message)
  }
  if (raised === null) throw new Error(`expected a failure containing "${fragment}", but the statement succeeded`)
  if (!raised.includes(fragment)) {
    throw new Error(`expected a failure containing "${fragment}", got: ${raised.trim()}`)
  }
}

void main()
