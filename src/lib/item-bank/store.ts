import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { familySeedKey, type ExistingBankState } from './plan'

/**
 * The write port for bank ingest.
 *
 * `ingest.ts` owns the interesting part — the ordering, the idempotency
 * decision, the all-or-nothing refusal — and knows nothing about how rows
 * reach storage. This exists for one concrete reason: the ingest round trip
 * has to be demonstrable against a REAL PostgreSQL database with the real
 * migrations, triggers and constraints applied, and the environment this was
 * built in has no Docker and therefore no local Supabase/PostgREST (see
 * scripts/README-pg-migrate-check.md). `scripts/cognitive/ingest-roundtrip.ts`
 * supplies a psql-backed implementation of this same interface and runs the
 * same orchestration, so the round trip exercises the production decision
 * logic rather than a re-implementation of it.
 *
 * Methods are deliberately primitive (one table each). Anything that has to
 * happen in a particular order is ordering `ingest.ts` performs, not ordering
 * an implementation is trusted to reproduce.
 */

export type GenerationRunInsert = {
  kind: 'figural_matrix'
  generatorName: string
  generatorVersion: string
  gitSha: string | null
  seed: string
  params: unknown
  requestedByProfileId: string | null
  startedAt: string
}

export type GenerationRunFinish = {
  status: 'succeeded' | 'failed'
  itemsProposed: number
  itemsAccepted: number
  itemsRejected: number
  qaSummary: unknown
  errorMessage: string | null
  completedAt: string
}

export type FamilyInsert = {
  code: string
  constructId: string
  kind: 'figural_matrix'
  rules: string[]
  radicals: unknown
  /** `item_families.predicted_b` — a DESIGN PRIOR, never a measured value. */
  difficultyPriorB: number
  /** `item_families.band` — the band of that prior. */
  difficultyPriorBand: string
  notes: string | null
}

export type ItemInsert = {
  responseFormatId: string
  constructId: string
  familyId: string
  stem: string
  purpose: 'construct' | 'practice' | 'seed'
  /** Legacy coarse enum; derived from the design prior. See ingest.ts. */
  difficulty: 'easy' | 'medium' | 'hard'
  contentHash: string
  displayOrder: number
}

export type OptionInsert = {
  itemId: string
  label: string
  value: number
  displayOrder: number
}

export type ItemSpecInsert = {
  itemId: string
  kind: 'figural_matrix'
  spec: unknown
  generationRunId: string
  generatorSeed: string
  qa: unknown
  contentHash: string
}

export type OptionSpecInsert = {
  optionId: string
  itemId: string
  spec: unknown
}

export type AnswerKeyInsert = {
  itemId: string
  correctOptionId: string
  rationale: string | null
  createdByProfileId: string | null
}

export type OptionDiagnosticInsert = {
  optionId: string
  itemId: string
  errorLabel: string
  rationale: string | null
}

export interface ItemBankStore {
  /**
   * Everything the plan needs to know about what is already there, for the
   * families and hashes this bank touches. Scoped by argument rather than
   * loading the whole bank, so ingest stays O(bank) not O(database).
   */
  loadExistingState(familyCodes: readonly string[], contentHashes: readonly string[]): Promise<ExistingBankState>
  createGenerationRun(row: GenerationRunInsert): Promise<string>
  finishGenerationRun(runId: string, patch: GenerationRunFinish): Promise<void>
  createFamily(row: FamilyInsert): Promise<string>
  createItem(row: ItemInsert): Promise<string>
  /** Returns the new option ids in the SAME order as `rows`. */
  createOptions(rows: readonly OptionInsert[]): Promise<string[]>
  createItemSpec(row: ItemSpecInsert): Promise<void>
  createOptionSpecs(rows: readonly OptionSpecInsert[]): Promise<void>
  createAnswerKey(row: AnswerKeyInsert): Promise<void>
  createOptionDiagnostics(rows: readonly OptionDiagnosticInsert[]): Promise<void>
  setFamilyExemplar(familyId: string, itemId: string): Promise<void>
}

function fail(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`${context}: ${error.message}`)
}

/**
 * Production implementation. Requires a service-role client: every table it
 * touches is service-role-only by RLS and grant (20260813100500 §1.2.5).
 */
export function createSupabaseItemBankStore(db: SupabaseClient): ItemBankStore {
  return {
    async loadExistingState(familyCodes, contentHashes) {
      const familyIdByCode = new Map<string, string>()
      const itemIdByContentHash = new Map<string, string>()
      const itemByFamilySeed = new Map<string, { itemId: string; contentHash: string | null }>()

      if (familyCodes.length > 0) {
        const { data, error } = await db
          .from('item_families')
          .select('id, code')
          .in('code', familyCodes as string[])
        fail('item_families lookup', error)
        for (const row of (data ?? []) as Array<{ id: string; code: string }>) {
          familyIdByCode.set(row.code, row.id)
        }
      }

      if (contentHashes.length > 0) {
        const { data, error } = await db
          .from('items')
          .select('id, content_hash')
          .in('content_hash', contentHashes as string[])
          .is('deleted_at', null)
        fail('items content_hash lookup', error)
        for (const row of (data ?? []) as Array<{ id: string; content_hash: string | null }>) {
          if (row.content_hash) itemIdByContentHash.set(row.content_hash, row.id)
        }
      }

      const familyIds = [...familyIdByCode.values()]
      if (familyIds.length > 0) {
        // Identity is (family code, generator seed). The seed lives on
        // cognitive_item_specs; the family on items. Join through the spec
        // table so only cognitive items are considered.
        const { data, error } = await db
          .from('cognitive_item_specs')
          .select('item_id, generator_seed, items!inner(id, family_id, content_hash, deleted_at)')
          .in('items.family_id', familyIds)
          .is('items.deleted_at', null)
        fail('cognitive_item_specs identity lookup', error)

        const codeById = new Map([...familyIdByCode].map(([code, id]) => [id, code]))
        type Row = {
          item_id: string
          generator_seed: string | null
          items: { family_id: string | null; content_hash: string | null } | null
        }
        for (const row of (data ?? []) as unknown as Row[]) {
          const code = row.items?.family_id ? codeById.get(row.items.family_id) : undefined
          if (!code || !row.generator_seed) continue
          itemByFamilySeed.set(familySeedKey(code, row.generator_seed), {
            itemId: row.item_id,
            contentHash: row.items?.content_hash ?? null,
          })
        }
      }

      return { familyIdByCode, itemIdByContentHash, itemByFamilySeed }
    },

    async createGenerationRun(row) {
      const { data, error } = await db
        .from('cognitive_generation_runs')
        .insert({
          kind: row.kind,
          generator_name: row.generatorName,
          generator_version: row.generatorVersion,
          git_sha: row.gitSha,
          seed: row.seed,
          params: row.params,
          status: 'running',
          requested_by: row.requestedByProfileId,
          started_at: row.startedAt,
        })
        .select('id')
        .single()
      fail('cognitive_generation_runs insert', error)
      return (data as { id: string }).id
    },

    async finishGenerationRun(runId, patch) {
      const { error } = await db
        .from('cognitive_generation_runs')
        .update({
          status: patch.status,
          items_proposed: patch.itemsProposed,
          items_accepted: patch.itemsAccepted,
          items_rejected: patch.itemsRejected,
          qa_summary: patch.qaSummary,
          error_message: patch.errorMessage,
          completed_at: patch.completedAt,
        })
        .eq('id', runId)
      fail('cognitive_generation_runs update', error)
    },

    async createFamily(row) {
      const { data, error } = await db
        .from('item_families')
        .insert({
          code: row.code,
          construct_id: row.constructId,
          kind: row.kind,
          rules: row.rules,
          radicals: row.radicals,
          predicted_b: row.difficultyPriorB,
          band: row.difficultyPriorBand,
          notes: row.notes,
        })
        .select('id')
        .single()
      fail('item_families insert', error)
      return (data as { id: string }).id
    },

    async createItem(row) {
      const { data, error } = await db
        .from('items')
        .insert({
          response_format_id: row.responseFormatId,
          construct_id: row.constructId,
          family_id: row.familyId,
          stem: row.stem,
          purpose: row.purpose,
          difficulty: row.difficulty,
          content_hash: row.contentHash,
          display_order: row.displayOrder,
          status: 'draft',
          lifecycle_state: 'draft',
        })
        .select('id')
        .single()
      fail('items insert', error)
      return (data as { id: string }).id
    },

    async createOptions(rows) {
      const { data, error } = await db
        .from('item_options')
        .insert(
          rows.map((row) => ({
            item_id: row.itemId,
            label: row.label,
            value: row.value,
            display_order: row.displayOrder,
            // Explicitly NULL: forbid_option_keys_on_cognitive_items_trg
            // (20260813101000) rejects any score_value on a cognitive item —
            // keys live in item_answer_keys and nowhere else.
            score_value: null,
          })),
        )
        .select('id, display_order')
      fail('item_options insert', error)
      const byOrder = new Map(
        ((data ?? []) as Array<{ id: string; display_order: number }>).map((r) => [r.display_order, r.id]),
      )
      return rows.map((row) => {
        const id = byOrder.get(row.displayOrder)
        if (!id) throw new Error(`item_options insert did not return an id for display_order ${row.displayOrder}`)
        return id
      })
    },

    async createItemSpec(row) {
      const { error } = await db.from('cognitive_item_specs').insert({
        item_id: row.itemId,
        kind: row.kind,
        spec: row.spec,
        generation_run_id: row.generationRunId,
        generator_seed: row.generatorSeed,
        qa: row.qa,
        content_hash: row.contentHash,
      })
      fail('cognitive_item_specs insert', error)
    },

    async createOptionSpecs(rows) {
      if (rows.length === 0) return
      const { error } = await db
        .from('cognitive_option_specs')
        .insert(rows.map((row) => ({ option_id: row.optionId, item_id: row.itemId, spec: row.spec })))
      fail('cognitive_option_specs insert', error)
    },

    async createAnswerKey(row) {
      const { error } = await db.from('item_answer_keys').insert({
        item_id: row.itemId,
        correct_option_id: row.correctOptionId,
        rationale: row.rationale,
        created_by: row.createdByProfileId,
      })
      fail('item_answer_keys insert', error)
    },

    async createOptionDiagnostics(rows) {
      if (rows.length === 0) return
      const { error } = await db.from('item_option_diagnostics').insert(
        rows.map((row) => ({
          option_id: row.optionId,
          item_id: row.itemId,
          error_label: row.errorLabel,
          rationale: row.rationale,
        })),
      )
      fail('item_option_diagnostics insert', error)
    },

    async setFamilyExemplar(familyId, itemId) {
      const { error } = await db.from('item_families').update({ exemplar_item_id: itemId }).eq('id', familyId)
      fail('item_families exemplar update', error)
    },
  }
}
