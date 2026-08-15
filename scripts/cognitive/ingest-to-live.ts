/**
 * Load a generated figural-matrix bank into a REAL project (LR-8 / #347).
 *
 * Generates the bank from a seed, ingests it, then ingests the identical bank
 * a second time to prove the run wrote nothing the first pass had not already
 * written. Idempotency is by content hash, so re-running after a partial load
 * completes it rather than duplicating it.
 *
 * NOT A TEST HARNESS. Its sibling `ingest-roundtrip.ts` exercises the lifecycle
 * and sign-off guards by recording reviews and walking an item through the
 * transition graph — appropriate against the throwaway cluster it targets, and
 * never against a live project. Nothing here writes to `item_reviews`, creates
 * users, or moves an item off `draft`: a sign-off has to come from a person
 * reviewing the item in the admin UI, which is the entire point of that ledger.
 * Everything this loads lands as `draft` and stays there.
 *
 * WHY IT TALKS TO psql AND NOT SUPABASE. Ingest's production store speaks
 * PostgREST via the Supabase client. Driving it over psql instead keeps the
 * ORCHESTRATION and the IDEMPOTENCY DECISION the production ones — both are
 * imported directly — while making the load a single connection that either
 * lands or fails loudly. Every real trigger, CHECK, FK and unique index fires
 * either way.
 *
 * Usage — against a live project (needs the DB password):
 *   node --import ./scripts/cognitive/register-ts-loader.mjs \
 *     scripts/cognitive/ingest-to-live.ts \
 *     --conn='postgresql://postgres@db.<ref>.supabase.co:5432/postgres' \
 *     --requested-by=<your-profile-uuid> --per-family=10 --confirm
 *
 * Usage — against a local cluster from scripts/pg-migrate-check.sh:
 *   scripts/cognitive/ingest-to-live.ts --host=<socket-dir> [--port=55432] --confirm
 *
 * `--confirm` is required: without it the script prints what it would write
 * and exits without touching the database.
 */
import { execFileSync } from 'node:child_process'
import { generateBatch } from '@/lib/cognitive/generator/index'
import { ALL_FAMILIES } from '@/lib/cognitive/generator/families/index'
import { bankFromGeneration } from '@/lib/item-bank/from-generation'
import { ingestGeneratedBank } from '@/lib/item-bank/ingest'
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
const CONN = args.conn ?? null
const HOST = args.host ?? `${process.env.TMPDIR ?? '/tmp'}/pg-migrate-check/run`
const PORT = args.port ?? '55432'
const PER_FAMILY = Number.parseInt(args['per-family'] ?? '2', 10)
const SEED = args.seed ?? 'pilot-2026-08-13'
const CONFIRMED = args.confirm === 'true'

/** Non-verbal inductive reasoning — see 20260815073019. NOT a self-report construct. */
const CONSTRUCT_ID = args.construct ?? 'a2000000-0000-0000-0000-000000000006'
/** Figural Matrix (5-option), type=cognitive — see 20260815060500. */
const RESPONSE_FORMAT_ID = args['response-format'] ?? 'a5000000-0000-0000-0000-000000000009'
/** Whose profile the generation run is attributed to. No default: it is a real person. */
const REQUESTED_BY = args['requested-by'] ?? null

/** A conninfo string goes in psql's dbname position; otherwise use host/port. */
const TARGET = CONN ? [CONN] : ['-h', HOST, '-p', PORT, '-U', 'postgres', '-d', 'postgres']

function sql(text: string): string {
  return execFileSync('psql', [...TARGET, '-tAqc', text], {
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
    async deletePartialItemByContentHash(contentHash: string): Promise<void> {
      // Best-effort: runs while another error is propagating. Children cascade.
      try {
        sql(`DELETE FROM items WHERE content_hash = ${lit(contentHash)}`)
      } catch {
        // Leaving the orphan is no worse than before this existed.
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Preconditions. The bank hangs off rows that migrations own — this script
// creates none of them, so a missing one is a migration that has not been
// applied, not something to paper over with an upsert.
// ---------------------------------------------------------------------------
function checkPreconditions(): void {
  const missing: string[] = []

  const construct = sql(
    `SELECT name || ' / ' || slug FROM constructs WHERE id = ${lit(CONSTRUCT_ID)}::uuid AND deleted_at IS NULL`,
  )
  if (!construct) missing.push(`construct ${CONSTRUCT_ID} (migration 20260815073019)`)

  const format = sql(
    `SELECT name || ' / ' || type FROM response_formats WHERE id = ${lit(RESPONSE_FORMAT_ID)}::uuid`,
  )
  if (!format) missing.push(`response format ${RESPONSE_FORMAT_ID} (migration 20260815060500)`)
  else if (!format.endsWith('/ cognitive')) {
    missing.push(`response format ${RESPONSE_FORMAT_ID} is "${format}", expected type=cognitive`)
  }

  if (!REQUESTED_BY) {
    missing.push('--requested-by=<profile-uuid> (the run is attributed to a real person)')
  } else if (!sql(`SELECT email FROM profiles WHERE id = ${lit(REQUESTED_BY)}::uuid`)) {
    missing.push(`profile ${REQUESTED_BY} does not exist`)
  }

  if (missing.length > 0) {
    console.error('Refusing to load. Missing:')
    for (const m of missing) console.error(`  - ${m}`)
    process.exit(1)
  }

  console.log(`construct       ${construct}  (${CONSTRUCT_ID})`)
  console.log(`response format ${format}  (${RESPONSE_FORMAT_ID})`)
  console.log(`attributed to   ${sql(`SELECT email FROM profiles WHERE id = ${lit(REQUESTED_BY!)}::uuid`)}`)
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
  checkPreconditions()

  const startedAt = new Date().toISOString()
  const result = generateBatch(ALL_FAMILIES, SEED, PER_FAMILY)

  // Shared with the admin "generate and ingest" action, so a seed run from here
  // and a seed run from the UI produce identical content hashes — which is what
  // lets either one finish a load the other started.
  const bank = bankFromGeneration(result, ALL_FAMILIES, {
    seed: SEED,
    perFamily: PER_FAMILY,
    startedAt,
    finishedAt: new Date().toISOString(),
  })
  const familyCount = new Set(bank.items.map((i) => i.familyCode)).size
  console.log(`\nGenerated ${bank.items.length} items across ${familyCount} families from seed "${SEED}".`)

  if (!CONFIRMED) {
    console.log('\nDRY RUN — nothing written. Re-run with --confirm to load.')
    return
  }

  const store = createPsqlStore()
  const before = counts()
  console.log('\nBEFORE      ', JSON.stringify(before))

  const ingestOptions = {
    bank,
    constructId: CONSTRUCT_ID,
    responseFormatId: RESPONSE_FORMAT_ID,
    requestedByProfileId: REQUESTED_BY!,
  }

  const first = await ingestGeneratedBank(store, ingestOptions)
  const afterFirst = counts()
  console.log('PASS 1      ', JSON.stringify(first))
  console.log('AFTER PASS 1', JSON.stringify(afterFirst))

  // Second pass over the identical bank. Anything it writes is a duplicate the
  // content-hash check failed to catch, so it is the load's own verification.
  const second = await ingestGeneratedBank(store, ingestOptions)
  const afterSecond = counts()
  console.log('PASS 2      ', JSON.stringify(second))
  console.log('AFTER PASS 2', JSON.stringify(afterSecond))

  let ok = true
  const expectedInserts = bank.items.length - first.itemsSkipped
  if (first.itemsInserted !== expectedInserts) {
    console.error(`FAIL: pass 1 inserted ${first.itemsInserted}, expected ${expectedInserts}`)
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

  // Nothing here is entitled to promote an item. If a load ever produces a row
  // past `draft`, something wrote a sign-off it had no business writing.
  const promoted = sql(
    `SELECT count(*) FROM items i JOIN item_families f ON f.id = i.family_id
      WHERE f.kind = 'figural_matrix' AND i.lifecycle_state <> 'draft'`,
  )
  if (promoted !== '0') {
    console.error(`FAIL: ${promoted} figural-matrix items are past draft; a load must never promote`)
    ok = false
  }

  console.log(`\nRESULT: ${ok ? 'PASS' : 'FAIL'}`)
  console.log('Every item is draft. Content and fairness review happen in the admin UI,')
  console.log('by people, before any of this reaches a respondent.')
  if (!ok) process.exitCode = 1
}

void main()
